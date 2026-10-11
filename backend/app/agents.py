"""The five Kintsugi agents and the flows that connect them.

Each step writes an AgentEvent, which the Mission control screen replays live.
Oracle → Scout → Architect → Market (seller, buyer, bundler) → Ledger.
"""

from __future__ import annotations

import asyncio
import base64
from typing import Any, Optional

from . import ladder, ledger, maps
from .bundler import propose_bundles, scrap_value
from .config import Settings
from .dedup import dedup_items
from .demo import fixtures
from .geo import haversine_km
from .llm.base import LLM, MediaRef
from .materials import canonical_material
from .models import (
    AgentEvent, Component, Deal, GeoPoint, Item, Participant, Prediction, Rung, Site,
)
from .negotiation import NegotiationSetup, run_negotiation, sandbox_settlement
from .store.base import Store

RUNG_LABEL = {
    Rung.REUSE: "reuse", Rung.REPAIR: "repair", Rung.UPCYCLE: "upcycle", Rung.HARVEST_PARTS: "harvest parts",
    Rung.RECYCLE: "recycle", Rung.RECOVER_ENERGY: "recover energy", Rung.SAFE_DISPOSAL: "safe disposal",
}


class Emitter:
    """Writes mission-control events for one job, optionally pausing so a demo is watchable."""

    def __init__(self, store: Store, job_id: str, delay: float = 0.0):
        self.store, self.job_id, self.delay = store, job_id, delay

    async def __call__(self, agent: str, step: str, message: str, pause: bool = True, **data: Any) -> None:
        self.store.add_event(AgentEvent(job_id=self.job_id, agent=agent, step=step, message=message, data=data))
        if pause and self.delay:
            await asyncio.sleep(self.delay)


def item_text(item: Item) -> str:
    mats = ", ".join(sorted({canonical_material(c.material) for c in item.components}))
    return f"{item.type}. {item.description}. Materials: {mats}. Condition {item.condition}."


def items_from_scout(raw: dict[str, Any], site: Site, seller_id: str, synthetic: bool) -> list[Item]:
    items = []
    lang = raw.get("narration_language") or "en"
    for r in raw.get("items", []):
        conf = float(r.get("confidence", 0.5))
        items.append(
            Item(
                site_id=site.id,
                type=r["type"],
                description=r.get("description", ""),
                count=int(r.get("count", 1)),
                condition=r.get("condition", "C"),
                condition_reason=r.get("condition_reason", ""),
                confidence=conf,
                dimensions_cm=r.get("dimensions_cm") or None,
                timestamps_s=r.get("timestamps_s", []),
                components=[Component(**c) for c in r.get("components", [])],
                hazards=r.get("hazards", []),
                tap_test=r.get("tap_test"),
                needs_verification=conf < 0.6,
                location=site.location,
                language=lang,
                seller_id=seller_id,
                synthetic=synthetic,
            )
        )
    return items


# ---------------------------------------------------------------- Scout

async def scout_ingest(
    store: Store, llm: LLM, settings: Settings, emit: Emitter, raw: dict[str, Any],
    site: Site, seller_id: str, city: str = "Bengaluru", quiet: bool = False,
) -> list[Item]:
    """Everything after the model has watched the media: dedup, price, ladder, carbon, save."""
    synthetic = settings.mock_mode
    items = items_from_scout(raw, site, seller_id, synthetic)
    if not quiet and raw.get("narration_summary_en"):
        await emit("scout", "narration", f"Heard ({raw.get('narration_language', '?')}): {raw['narration_summary_en']}")
    if not quiet:
        await emit("scout", "found", f"Found {len(items)} kind{'s' if len(items) != 1 else ''} of item at {site.name}", count=len(items))

    vectors = await llm.embed_texts([item_text(i) for i in items]) if items else []
    for it, vec in zip(items, vectors):
        it.embedding = vec
    before = len(items)
    items = dedup_items(items)
    if len(items) < before and not quiet:
        await emit("scout", "dedup", f"Merged {before - len(items)} repeated sightings")

    prices = await llm.price_items(
        [{"type": i.type, "condition": i.condition, "description": i.description} for i in items], city
    )
    for it, p in zip(items, prices):
        it.value_min_inr, it.value_max_inr = p.get("value_min_inr"), p.get("value_max_inr")
        it.repair_cost_inr, it.price_sources = p.get("repair_cost_inr"), p.get("sources", [])

    participants = store.list_participants()
    discovered = await maps.find_destinations(site.location, settings)
    for p in discovered:
        store.upsert_participant(p)
    if discovered and not quiet:
        await emit("scout", "places", f"Found {len(discovered)} nearby businesses on Google Maps")
    ctx = ladder.LadderContext(participants + discovered, settings.search_radius_km)

    decided = []
    for it in items:
        d = ladder.decide(it, ctx)
        d.co2_avoided_kg = ledger.co2_avoided_for_item(d)
        decided.append(d)
        if quiet:
            continue
        if d.tap_test == "hollow":
            await emit("scout", "tap_test", f"Tap test on {d.type}: hollow, likely detached", item_id=d.id)
        if d.hazards:
            await emit("scout", "hazard", f"{d.type}: {d.hazards[0]}", item_id=d.id)
        await emit(
            "scout", "passport",
            f"{d.type} ×{d.count} → {RUNG_LABEL[d.next_life]}: {d.next_life_reason}",
            item_id=d.id, rung=d.next_life.value,
        )
    store.upsert_items(decided)
    return decided


async def scout_scan(
    store: Store, llm: LLM, settings: Settings, emit: Emitter, media: list[MediaRef],
    site: Site, seller_id: str, narration_text: Optional[str] = None,
) -> list[Item]:
    store.upsert_site(site)
    await emit("scout", "start", f"Watching {len(media)} file(s) from {site.name}")
    raw = await llm.scout_media(media, site.kind, narration_text)
    return await scout_ingest(store, llm, settings, emit, raw, site, seller_id)


# ---------------------------------------------------------------- Oracle

async def oracle_ingest(store: Store, llm: LLM, settings: Settings, emit: Emitter, doc: MediaRef) -> list[Prediction]:
    await emit("oracle", "start", f"Reading {doc.name}")
    raw = await llm.oracle_document(doc)
    fixture_locs = {p.title: p.location for p in fixtures.predictions()}
    preds = []
    for r in raw.get("predictions", []):
        loc = await maps.geocode(r.get("address", ""), settings) or fixture_locs.get(r.get("title", ""))
        if loc is None:
            await emit("oracle", "skip", f"Could not place '{r.get('title')}' on the map")
            continue
        p = Prediction(
            kind=r["kind"], title=r["title"], address=r.get("address", ""), location=loc,
            expected_date=r.get("expected_date", ""), expected_materials=r.get("expected_materials", []),
            confidence=float(r.get("confidence", 0.5)), source_language=r.get("source_language", "en"),
            source_excerpt=r.get("source_excerpt", ""), synthetic=settings.mock_mode,
        )
        preds.append(p)
        await emit("oracle", "prediction", f"{'Future supply' if p.kind == 'supply' else 'Future demand'}: {p.title} "
                   f"({p.source_language}), {p.expected_date or 'date unknown'}", prediction_id=p.id)
    store.upsert_predictions(preds)
    return preds


# ---------------------------------------------------------------- Architect

def _unit_price(it: Item) -> Optional[float]:
    if it.value_min_inr is None or it.value_max_inr is None:
        return None
    return round((it.value_min_inr + it.value_max_inr) / 2, 2)


async def search(
    store: Store, llm: LLM, settings: Settings, query: Optional[str] = None,
    image: Optional[tuple[bytes, str]] = None, near: Optional[GeoPoint] = None, limit: int = 12,
) -> list[dict[str, Any]]:
    if image:
        vec = await llm.embed_image(*image)
    else:
        vec = (await llm.embed_texts([query or ""]))[0]
    results = []
    for it, score in store.nearest_items(vec, limit=limit * 3):
        if it.status != "available" or it.next_life not in (Rung.REUSE, Rung.REPAIR, Rung.UPCYCLE, None):
            continue
        dist = haversine_km(near, it.location) if near else None
        if dist is not None and dist > settings.search_radius_km:
            continue
        results.append({"item": it.model_dump(mode="json"), "score": round(score, 3),
                        "distance_km": round(dist, 1) if dist is not None else None})
    results.sort(key=lambda r: r["score"], reverse=True)
    return [r for r in results if r["score"] > 0.15][:limit]


async def architect_design(
    store: Store, llm: LLM, settings: Settings, emit: Emitter, brief: str, budget_inr: float, near: GeoPoint,
) -> dict[str, Any]:
    await emit("architect", "start", f"Design brief: {brief} (budget ₹{budget_inr:,.0f})")
    found = await search(store, llm, settings, query=brief + " door light tile basin", near=near, limit=10)
    candidates = [
        {"id": r["item"]["id"], "type": r["item"]["type"], "count": r["item"]["count"],
         "condition": r["item"]["condition"], "unit_price_inr": _unit_price(Item.model_validate(r["item"])),
         "distance_km": r["distance_km"]}
        for r in found
    ]
    await emit("architect", "candidates", f"{len(candidates)} reclaimed items within {settings.search_radius_km:.0f} km match")
    plan = await llm.design(brief, budget_inr, candidates)
    by_id = {c["id"]: c for c in candidates}
    lines, total = [], 0.0
    for s in plan.get("selected", []):
        c = by_id.get(s["item_id"])
        if not c:
            continue  # the model may only use listed items
        cost = (c["unit_price_inr"] or 0) * s["quantity"]
        total += cost
        lines.append({**s, "type": c["type"], "unit_price_inr": c["unit_price_inr"], "cost_inr": cost})
        await emit("architect", "select", f"{s['quantity']} × {c['type']}: {s['use']}", item_id=c["id"])
    image = await llm.render(plan.get("render_prompt", brief))
    render_b64 = base64.b64encode(image).decode() if image else None
    await emit("architect", "done", f"Concept ready, estimated ₹{total:,.0f} in reclaimed materials"
               + ("" if render_b64 else " (render needs live mode)"))
    return {"concept": plan.get("concept", ""), "lines": lines, "total_inr": round(total, 2),
            "render_png_b64": render_b64, "render_prompt": plan.get("render_prompt", "")}


# ---------------------------------------------------------------- Market

def _summary(items: list[Item]) -> str:
    return ", ".join(f"{i.count} {i.type}{'s' if i.count > 1 and not i.type.endswith('s') else ''}" for i in items)


async def negotiate_deal(
    store: Store, llm: LLM, settings: Settings, emit: Emitter, item_ids: list[str], buyer_id: str,
    budget_cap_inr: Optional[float] = None,
) -> Deal:
    items = [store.get_item(i) for i in item_ids]
    items = [i for i in items if i is not None]
    if not items:
        raise ValueError("No such items")
    sellers = {i.seller_id for i in items}
    if len(sellers) != 1:
        raise ValueError("A deal must contain items from one seller")
    seller_id = sellers.pop()
    seller = store.get_participant(seller_id)
    buyer = store.get_participant(buyer_id)
    if buyer is None:
        raise ValueError("Unknown buyer")
    list_price = sum((i.value_max_inr or 0) * i.count for i in items)
    min_value = sum((i.value_min_inr or 0) * i.count for i in items)
    floor = (seller.floor_price_inr if seller and seller.floor_price_inr else round(min_value * 0.9, -1))
    cap = budget_cap_inr or buyer.budget_cap_inr or list_price
    setup = NegotiationSetup(
        item_summary=_summary(items), list_price=list_price, seller_floor=floor, buyer_cap=cap,
        seller_lang=seller.language if seller else "en", buyer_lang=buyer.language,
    )
    deal = Deal(item_ids=[i.id for i in items], seller_id=seller_id, buyer_id=buyer_id)
    for i in items:
        i.status = "in_deal"
    store.upsert_items(items)
    store.upsert_deal(deal)
    await emit("market", "start", f"{seller.name if seller else seller_id} ({setup.seller_lang}) and {buyer.name} "
               f"({setup.buyer_lang}) start negotiating: {setup.item_summary}", deal_id=deal.id)

    async def on_turn(turn):
        deal.transcript.append(turn)
        store.upsert_deal(deal)
        await emit(turn.speaker, turn.action, turn.messages.get("en", ""), deal_id=deal.id, turn=turn.model_dump(mode="json"))
        if turn.guardrail_applied:
            await emit("market", "guardrail", turn.guardrail_note, deal_id=deal.id)

    result = await run_negotiation(setup, llm, on_turn)
    deal.status = "agreed" if result.status == "agreed" else "no_deal"
    deal.final_price_inr = result.final_price
    if deal.status == "no_deal":
        for i in items:
            i.status = "available"
        store.upsert_items(items)
    store.upsert_deal(deal)
    await emit("market", deal.status, f"Agreed at ₹{result.final_price:,.0f}; waiting for {buyer.name} to approve"
               if result.final_price else "No deal: the limits did not overlap", deal_id=deal.id)
    return deal


async def approve_deal(store: Store, emit: Emitter, deal_id: str) -> Deal:
    deal = store.get_deal(deal_id)
    if deal is None or deal.status != "agreed" or deal.final_price_inr is None:
        raise ValueError("Deal is not waiting for approval")
    items = [i for i in (store.get_item(x) for x in deal.item_ids) if i]
    total_value = sum((i.value_max_inr or 0) * i.count for i in items) or 1.0
    lines = [{"item_id": i.id, "type": i.type, "quantity": i.count} for i in items]
    deal.status = "approved"
    await emit("buyer", "approved", "Buyer approved the payment", deal_id=deal.id)
    deal.settlement = sandbox_settlement(deal.id, deal.buyer_id, deal.seller_id, lines, deal.final_price_inr)
    deal.status = "settled"
    entries = []
    for i in items:
        share = deal.final_price_inr * ((i.value_max_inr or 0) * i.count) / total_value
        i.status = "sold"
        i.destination_id = deal.buyer_id
        entries += ledger.entries_for_item(i, deal.id, share)
    store.upsert_items(items)
    store.add_ledger(entries)
    store.upsert_deal(deal)
    t = ledger.totals(entries)
    await emit("ledger", "deal", f"Settled (sandbox). {t['mass_diverted_kg']:,.0f} kg reused, "
               f"{t['co2_avoided_kg']:,.0f} kg CO2 avoided", deal_id=deal.id)
    return deal


async def run_bundling(store: Store, emit: Emitter) -> list:
    sites = {s.id: s for s in store.list_sites()}
    dealers = [p for p in store.list_participants() if p.role == "dealer"]
    bundles = propose_bundles(store.list_items(), dealers, sites)
    for b in bundles:
        dealer = store.get_participant(b.dealer_id)
        await emit("bundler", "proposed", f"Bundled {len(b.item_ids)} items from {len(b.route)} homes for "
                   f"{dealer.name}: {b.total_weight_kg:.1f} kg, ₹{b.total_value_inr:,.0f} "
                   f"(minimum ₹{dealer.min_bundle_value_inr:,.0f})", bundle_id=b.id)
        b.status = "accepted"
        store.upsert_bundle(b)
        await emit("seller", "accept", f"{dealer.name} accepted one pickup route", bundle_id=b.id)
        entries = []
        for iid in b.item_ids:
            it = store.get_item(iid)
            if it:
                it.status = "routed"
                value, _ = scrap_value(it, b.dealer_id)
                entries += ledger.entries_for_item(it, b.id, value)
                store.upsert_items([it])
        store.add_ledger(entries)
    return bundles


def ledger_summary(store: Store) -> dict[str, Any]:
    return ledger.totals(store.list_ledger())


# ---------------------------------------------------------------- Judge mode

def seed_participants(store: Store) -> list[Participant]:
    ps = fixtures.participants()
    for p in ps:
        store.upsert_participant(p)
    return ps


async def judge_mode(store: Store, llm: LLM, settings: Settings, job_id: str) -> dict[str, Any]:
    """The full story in about a minute: one chair, one building, one city."""
    emit = Emitter(store, job_id, delay=settings.demo_step_delay)
    store_reset_keep_job(store, job_id)
    seed_participants(store)
    await emit("system", "start", "Judge mode: sample data, Bengaluru. One chair, one building, one city.")

    # Oracle
    await oracle_ingest(store, llm, settings, emit, MediaRef(name="sample_notices.pdf", mime_type="application/pdf", data=b""))

    # One chair
    home = Site(id="site_home_hsr", owner_id="ppl_home_priya", kind="home", name="Home, HSR Layout", location=fixtures.HOME_HSR)
    await scout_scan(store, llm, settings, emit, [MediaRef(name="chair_hsr.mp4", mime_type="video/mp4", data=b"")],
                     home, seller_id="ppl_home_priya", narration_text="कुर्सी का पैर टूट गया है, सागौन की है")
    for n, nb in enumerate(fixtures.NEIGHBOURS):
        site = Site(id=f"site_nb_{n}", owner_id=f"ppl_nb_{n}", kind="home", name=nb["name"], location=nb["location"])
        store.upsert_site(site)
        await scout_ingest(store, llm, settings, emit, nb["scan"], site, seller_id=site.owner_id, quiet=True)
    await emit("scout", "neighbours", "3 neighbours on the same street also listed small items")
    await run_bundling(store, emit)

    # One building
    office = Site(id="site_office_kor", owner_id="ppl_ramesh", kind="building", name="Old office, Koramangala",
                  location=fixtures.OFFICE_KORAMANGALA)
    office_items = await scout_scan(
        store, llm, settings, emit, [MediaRef(name="office_walkthrough.mp4", mime_type="video/mp4", data=b"")],
        office, seller_id="ppl_ramesh",
    )

    # Design from what exists
    design = await architect_design(store, llm, settings, emit, "cozy café, 40 m², warm wood", 30000,
                                    fixtures.CAFE_INDIRANAGAR)

    # Cross-language deal: doors and lights from Ramesh (Hindi) to Ananya (English)
    deal_items = [i.id for i in office_items if any(k in i.type for k in ("door", "pendant"))]
    deal = await negotiate_deal(store, llm, settings, emit, deal_items, buyer_id="ppl_ananya")
    if deal.status == "agreed":
        await emit("buyer", "approve", "Ananya taps Approve")
        deal = await approve_deal(store, emit, deal.id)

    totals = ledger_summary(store)
    await emit("ledger", "city", f"City totals: {totals['mass_diverted_kg']:,.0f} kg diverted from landfill, "
               f"{totals['co2_avoided_kg']:,.0f} kg CO2 avoided, ₹{totals['value_recovered_inr']:,.0f} recovered")
    return {"deal_id": deal.id, "design": design, "totals": totals}


def store_reset_keep_job(store: Store, job_id: str) -> None:
    """Reset demo data but keep this job and its events so Mission control keeps streaming."""
    job = store.get_job(job_id)
    events = store.list_events(job_id)
    store.reset()
    if job:
        store.upsert_job(job)
    for e in events:
        store.add_event(e)
