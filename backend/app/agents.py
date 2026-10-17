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
from .evidence import attach_evidence, get_evidence_store
from .geo import haversine_km
from .llm.base import LLM, MediaRef
from .materials import canonical_material
from .models import (
    AgentEvent, Component, Deal, GeoPoint, Item, Participant, Prediction, Rung, Site, StandingRequest,
)
from .a2a_seller import A2ASeller, lot_summary, seller_terms
from .negotiation import BuyerBrain, LocalSeller, SellerBrain, negotiate, sandbox_settlement
from .store.base import Store

TAKE_APART_RUNGS = {Rung.HARVEST_PARTS, Rung.RECYCLE, Rung.RECOVER_ENERGY}

RUNG_LABEL = {
    Rung.REUSE: "reuse", Rung.REPAIR: "repair", Rung.UPCYCLE: "upcycle", Rung.HARVEST_PARTS: "harvest parts",
    Rung.RECYCLE: "recycle", Rung.RECOVER_ENERGY: "recover energy", Rung.SAFE_DISPOSAL: "safe disposal",
}


class Emitter:
    """Writes mission-control events for one job, optionally pausing so a demo is watchable."""

    def __init__(self, store: Store, job_id: str, delay: float = 0.0):
        self.store, self.job_id, self.delay = store, job_id, delay
        self._skipped = False

    def _skipping(self) -> bool:
        """The UI can fast-forward a demo; once skipped, stop pausing."""
        if not self._skipped:
            job = self.store.get_job(self.job_id)
            self._skipped = bool(job and job.skip)
        return self._skipped

    async def __call__(self, agent: str, step: str, message: str, pause: bool = True, **data: Any) -> None:
        self.store.add_event(AgentEvent(job_id=self.job_id, agent=agent, step=step, message=message, data=data))
        if pause and self.delay and not self._skipping():
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
                media_index=r.get("media_index"),
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
    media: Optional[list[MediaRef]] = None,
) -> list[Item]:
    """Everything after the model has watched the media: dedup, price, ladder, carbon, evidence,
    take-apart guidance, save."""
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

    # Evidence photos, faces blurred before anything is stored or shown
    if media:
        faces = await asyncio.to_thread(attach_evidence, decided, media, get_evidence_store())
        shots = sum(len(d.evidence) for d in decided)
        if shots and not quiet:
            await emit("scout", "evidence", f"Saved {shots} evidence photo{'s' if shots != 1 else ''}"
                       + (f", {faces} face{'s' if faces != 1 else ''} blurred" if faces else ", no faces found"))

    # Items that will be taken apart at home get step-by-step guidance in the owner's language
    if site.kind == "home":
        for d in decided:
            if d.next_life in TAKE_APART_RUNGS and len(d.components) > 1 and not d.hazards:
                steps = await llm.take_apart(d.type, [c.name for c in d.components], d.language)
                d.take_apart = {"en": steps["en"]}
                if d.language != "en":
                    d.take_apart[d.language] = steps["local"]
                if not quiet:
                    await emit("scout", "take_apart", f"Wrote {len(steps['en'])} take-apart steps for the {d.type}"
                               + (f" in {d.language} and English" if d.language != "en" else ""), item_id=d.id)
    store.upsert_items(decided)
    return decided


async def scout_scan(
    store: Store, llm: LLM, settings: Settings, emit: Emitter, media: list[MediaRef],
    site: Site, seller_id: str, narration_text: Optional[str] = None,
) -> list[Item]:
    store.upsert_site(site)
    kinds = sorted({m.mime_type.split("/")[0] for m in media})
    await emit("scout", "start", f"Watching {len(media)} file(s) ({', '.join(kinds)}) from {site.name}")
    raw = await llm.scout_media(media, site.kind, narration_text)
    items = await scout_ingest(store, llm, settings, emit, raw, site, seller_id, media=media)
    if site.kind == "home":
        await run_bundling(store, emit)  # small items from nearby homes may now make a pickup worthwhile
    await run_autopilot(store, llm, settings, emit, item_ids=[i.id for i in items])
    return items


# ---------------------------------------------------------------- People in the loop

async def update_item(store: Store, settings: Settings, item_id: str, patch: dict[str, Any]) -> Item:
    """A person confirms or corrects what Scout saw, or the seller sets a lowest price.
    The ladder and CO2 are recomputed so the passport stays consistent."""
    it = store.get_item(item_id)
    if it is None:
        raise ValueError("Item not found")
    if it.status != "available":
        raise ValueError("This item is already in a deal")
    for key in ("count", "condition", "floor_price_inr"):
        if patch.get(key) is not None:
            setattr(it, key, patch[key])
    if patch.get("verified") or any(patch.get(k) is not None for k in ("count", "condition")):
        it.verified = True
        it.needs_verification = False
    decided = ladder.decide(it, ladder.LadderContext(store.list_participants(), settings.search_radius_km))
    decided.co2_avoided_kg = ledger.co2_avoided_for_item(decided)
    store.upsert_items([decided])
    return decided


async def offer_item(store: Store, llm: LLM, settings: Settings, emit: Emitter, item_id: str) -> Deal:
    """One tap from a passport: offer this lot to the taker the ladder picked, and let the
    seller's and buyer's agents negotiate. (To sell several lots together, use Find.)"""
    it = store.get_item(item_id)
    if it is None or it.destination_id is None:
        raise ValueError("This item has no taker to offer it to")
    taker = store.get_participant(it.destination_id)
    if taker is None or taker.role not in ("buyer", "ngo", "dealer"):
        raise ValueError("The taker for this item doesn't buy items; it is routed instead")
    return await negotiate_deal(store, llm, settings, emit, [it.id], taker.id)


# ---------------------------------------------------------------- Autopilot

def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na, nb = sum(x * x for x in a) ** 0.5, sum(y * y for y in b) ** 0.5
    return dot / (na * nb) if na and nb else 0.0


async def set_autopilot(store: Store, llm: LLM, settings: Settings, emit: Emitter, item_id: str, on: bool) -> list[Deal]:
    """The seller lets their agent sell this item on its own, never below their private lowest
    price. Hazards are never sold this way: they go to a licensed handler."""
    it = store.get_item(item_id)
    if it is None:
        raise ValueError("Item not found")
    if on and it.hazards:
        raise ValueError("Suspected hazards go to a licensed handler, so they can't be sold on Autopilot.")
    if on and it.floor_price_inr is None:
        raise ValueError("Set your lowest price first, so your agent knows where to stop.")
    if it.status != "available":
        raise ValueError("This item is already in a deal")
    it.autopilot = on
    store.upsert_items([it])
    await emit("seller", "autopilot", f"Autopilot {'on' if on else 'off'} for the {it.type}"
               + (": the seller's agent will negotiate with matching buyers, never below the seller's lowest price." if on else "."))
    return await run_autopilot(store, llm, settings, emit, item_ids=[it.id]) if on else []


async def create_request(
    store: Store, llm: LLM, settings: Settings, emit: Emitter, buyer_id: str, query: str, near: GeoPoint,
    radius_km: float, cap_inr: Optional[float], auto_approve: bool,
) -> tuple[StandingRequest, list[Deal]]:
    """A buyer saves what they're looking for; Kintsugi checks what's listed now and every new scan."""
    buyer = store.get_participant(buyer_id)
    if buyer is None or buyer.role not in ("buyer", "ngo", "dealer"):
        raise ValueError("Only buyers, charities and dealers can save a standing request.")
    if auto_approve and not cap_inr:
        raise ValueError("Give a highest price to approve deals automatically.")
    req = StandingRequest(buyer_id=buyer_id, query=query.strip(), location=near, radius_km=radius_km,
                          cap_inr=cap_inr, auto_approve=auto_approve)
    req.embedding = (await llm.embed_texts([req.query]))[0]
    store.upsert_request(req)
    await emit("buyer", "request", f"{buyer.name} saved a standing request: {req.query}, within {radius_km:.0f} km"
               + (", approving automatically within a private limit." if auto_approve else "."))
    return req, await run_autopilot(store, llm, settings, emit, request_ids=[req.id])


async def run_autopilot(
    store: Store, llm: LLM, settings: Settings, emit: Emitter,
    item_ids: Optional[list[str]] = None, request_ids: Optional[list[str]] = None,
) -> list[Deal]:
    """Match listed items with buyers' standing requests. If the seller has put an item on
    Autopilot, the two agents negotiate on their own; a deal within the buyer's auto-approve limit
    settles without anyone tapping. Otherwise the buyer is told about the match. The limits stay
    private to each agent, and hazards are never matched."""
    requests = [r for r in store.list_requests() if r.active and r.embedding and (request_ids is None or r.id in request_ids)]
    deals: list[Deal] = []
    for req in requests:
        buyer = store.get_participant(req.buyer_id)
        if buyer is None:
            continue
        for it in store.list_items():
            if item_ids is not None and it.id not in item_ids:
                continue
            if (it.status != "available" or not it.embedding or it.hazards or it.seller_id == req.buyer_id
                    or it.id in req.matched_item_ids):
                continue
            score = _cosine(req.embedding or [], it.embedding)
            dist = haversine_km(req.location, it.location)
            if score < settings.autopilot_min_score or dist > req.radius_km:
                continue
            if not it.autopilot:
                if it.id in req.notified_item_ids:
                    continue
                req.notified_item_ids.append(it.id)
                store.upsert_request(req)
                await emit("market", "match", f"New match for {buyer.name}: {it.type}, {dist:.1f} km away, fits "
                           f"\"{req.query}\". The seller hasn't turned on Autopilot, so {buyer.name} can make an offer.")
                continue
            req.matched_item_ids.append(it.id)
            store.upsert_request(req)
            await emit("market", "autopilot", f"Autopilot: {it.type} fits {buyer.name}'s request \"{req.query}\", "
                       f"{dist:.1f} km away. Both agents start negotiating.")
            deal = await negotiate_deal(store, llm, settings, emit, [it.id], buyer.id, budget_cap_inr=req.cap_inr,
                                        autopilot=True)
            if deal.status == "agreed" and req.auto_approve:
                await emit("buyer", "autopilot", f"The price is within {buyer.name}'s auto-approve limit, "
                           "so the buyer agent approves.", deal_id=deal.id)
                deal = await approve_deal(store, emit, deal.id)
            deals.append(deal)
    return deals


# ---------------------------------------------------------------- Oracle

async def oracle_ingest(store: Store, llm: LLM, settings: Settings, emit: Emitter, doc: MediaRef) -> list[Prediction]:
    await emit("oracle", "start", f"Reading {doc.name}")
    raw = await llm.oracle_document(doc)
    fixture_locs = {p.title: p.location for p in fixtures.predictions()}
    known = {(p.title.lower(), p.address.lower()) for p in store.list_predictions()}
    preds = []
    for r in raw.get("predictions", []):
        if (r.get("title", "").lower(), r.get("address", "").lower()) in known:
            await emit("oracle", "known", f"Already on the map: {r.get('title')}")
            continue
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
    image: Optional[MediaRef] = None,
) -> dict[str, Any]:
    await emit("architect", "start", f"Design brief: {brief} (budget ₹{budget_inr:,.0f})"
               + (", with an inspiration photo" if image else ""))
    found = await search(store, llm, settings, query=brief + " door light tile basin", near=near, limit=10)
    candidates = [
        {"id": r["item"]["id"], "type": r["item"]["type"], "count": r["item"]["count"],
         "condition": r["item"]["condition"], "unit_price_inr": _unit_price(Item.model_validate(r["item"])),
         "distance_km": r["distance_km"]}
        for r in found
    ]
    await emit("architect", "candidates", f"{len(candidates)} reclaimed items within {settings.search_radius_km:.0f} km match")
    plan = await llm.design(brief, budget_inr, candidates, image)
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

async def negotiate_deal(
    store: Store, llm: LLM, settings: Settings, emit: Emitter, item_ids: list[str], buyer_id: str,
    budget_cap_inr: Optional[float] = None, autopilot: bool = False,
) -> Deal:
    """The buyer's agent negotiates with the seller's agent. Over A2A by default, so the seller's
    floor stays inside the seller agent; the buyer's cap stays here with the buyer agent."""
    items = [store.get_item(i) for i in item_ids]
    items = [i for i in items if i is not None]
    if not items:
        raise ValueError("No such items")
    if any(i.status != "available" for i in items):
        raise ValueError("Some of these items are already in a deal")
    sellers = {i.seller_id for i in items}
    if len(sellers) != 1:
        raise ValueError("A deal must contain items from one seller")
    seller_id = sellers.pop()
    seller = store.get_participant(seller_id)
    buyer = store.get_participant(buyer_id)
    if buyer is None:
        raise ValueError("Unknown buyer")
    list_price, floor = seller_terms(items, seller)
    cap = budget_cap_inr or buyer.budget_cap_inr or list_price
    seller_lang = seller.language if seller else "en"
    summary = lot_summary(items)

    deal = Deal(item_ids=[i.id for i in items], seller_id=seller_id, buyer_id=buyer_id, autopilot=autopilot)
    for i in items:
        i.status = "in_deal"
    store.upsert_items(items)
    store.upsert_deal(deal)
    await emit("market", "start", f"{seller.name if seller else seller_id} ({seller_lang}) and {buyer.name} "
               f"({buyer.language}) start negotiating: {summary}", deal_id=deal.id)

    async def on_turn(turn):
        deal.transcript.append(turn)
        store.upsert_deal(deal)
        await emit(turn.speaker, turn.action, turn.messages.get("en", ""), deal_id=deal.id, turn=turn.model_dump(mode="json"))
        if turn.guardrail_applied:
            await emit("market", "guardrail", turn.guardrail_note, deal_id=deal.id)

    buyer_brain = BuyerBrain(limit=cap)
    if settings.a2a_enabled:
        seller_port = A2ASeller(deal.id, buyer.language, settings)
        await emit("market", "a2a", "Buyer agent reached the seller agent over A2A "
                   "(agent card at /a2a/seller/.well-known/agent-card.json). The seller's floor stays with the seller agent.",
                   deal_id=deal.id)
    else:
        seller_port = LocalSeller(SellerBrain(limit=floor, list_price=list_price), llm, summary, seller_lang, buyer.language)
    try:
        result = await negotiate(seller_port, buyer_brain, llm, summary, seller_lang, buyer.language, on_turn=on_turn)
    except Exception:
        for i in items:
            i.status = "available"
        store.upsert_items(items)
        deal.status = "no_deal"
        store.upsert_deal(deal)
        raise
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


class SampleMediaLLM:
    """Judge mode films nothing: its sample videos, notice and prices come from the fixtures, so the
    story is the same every time and quick. Every other call (negotiation wording, take-apart steps,
    embeddings, speech) goes to the live model when there is one."""

    SAMPLED = ("scout_media", "oracle_document", "price_items")

    def __init__(self, live: LLM, settings: Settings):
        from .llm.mock import MockLLM

        self._live, self._sample = live, MockLLM(settings)

    def __getattr__(self, name: str) -> Any:
        return getattr(self._sample if name in self.SAMPLED else self._live, name)


async def judge_mode(store: Store, llm: LLM, settings: Settings, job_id: str) -> dict[str, Any]:
    """The full story in about a minute: one chair, one building, one city."""
    llm = SampleMediaLLM(llm, settings)  # type: ignore[assignment]
    # Everything the demo creates is sample data, labelled as such, with its own sample takers (no
    # live Places lookups), even when the model calls are live.
    settings = settings.model_copy(update={"mock_mode": True})
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
