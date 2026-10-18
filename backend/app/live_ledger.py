"""The live ledger: everything happening on Kintsugi as one feed, newest first, with the recorded
impact of each hand-over, sale and pickup traced line by line to its material and factor.

Like the rest of the API, it never includes a seller's lowest price or a buyer's highest price;
agreed prices are public once a deal is made."""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from .ledger import totals
from .materials import avoided_share, displacement, factor_source
from .store.base import Store

RUNG_WORDS = {"reuse": "reuse", "repair": "repair", "upcycle": "upcycling", "harvest_parts": "parts",
              "recycle": "recycling", "compost": "compost or biogas", "recover_energy": "energy recovery",
              "safe_disposal": "safe disposal"}


def _things(items: list) -> str:
    names = [f"{i.count} × {i.type}" if i.count > 1 else i.type for i in items]
    if not names:
        return "items"
    return ", ".join(names[:2]) + (f" and {len(names) - 2} more" if len(names) > 2 else "")


def build(store: Store, limit: int = 80) -> dict[str, Any]:
    people = {p.id: p for p in store.list_participants()}
    items = store.list_items()
    item_by_id = {i.id: i for i in items}
    entries = store.list_ledger()
    by_source: dict[str, list] = defaultdict(list)
    for e in entries:
        by_source[e.source_id].append(e)

    def name(pid: str) -> str:
        return people[pid].name if pid in people else "Someone"

    def lines(es: list) -> list[dict[str, Any]]:
        return [{"material": e.material, "next_life": e.rung.value, "kg": round(e.mass_kg, 1),
                 "factor": e.factor_kg_per_kg, "share": round(avoided_share(e.rung.value, e.material), 3),
                 "co2e_kg": round(e.co2_avoided_kg, 1)} for e in es]

    feed: list[dict[str, Any]] = []

    # Things listed, by scan
    by_site: dict[str, list] = defaultdict(list)
    for i in items:
        by_site[i.site_id].append(i)
    for s in store.list_sites():
        its = by_site.get(s.id, [])
        if not its:
            continue
        feed.append({
            "kind": "listed", "at": s.created_at, "who": name(s.owner_id),
            "text": f"{name(s.owner_id)} listed {_things(its)} ({'building survey' if s.kind == 'building' else 'home'})",
            "co2e_kg": round(sum(i.co2_avoided_kg or 0 for i in its if i.status == 'available'), 1), "recorded": False,
            "item_ids": [i.id for i in its], "sample": any(i.synthetic for i in its),
        })

    # Hand-overs, offers, sales
    for d in store.list_deals():
        its = [item_by_id[x] for x in d.item_ids if x in item_by_id]
        what = _things(its)
        es = by_source.get(d.id, [])
        t = totals(es) if es else None
        base = {"deal_id": d.id, "item_ids": d.item_ids, "sample": any(i.synthetic for i in its)}
        if d.kind == "handover":
            feed.append({**base, "kind": "handover", "at": d.created_at, "who": name(d.seller_id),
                         "text": f"{name(d.seller_id)} handed over {what} to {name(d.buyer_id)}, free",
                         "kg": t["mass_diverted_kg"] if t else None, "co2e_kg": t["co2_avoided_kg"] if t else None,
                         "recorded": bool(es), "lines": lines(es)})
            continue
        started_by = f"{name(d.buyer_id)}'s agent" if d.request_id else name(d.seller_id)
        feed.append({**base, "kind": "offer", "at": d.created_at, "who": started_by,
                     "text": f"{started_by} opened a negotiation: {what}, {name(d.seller_id)} → {name(d.buyer_id)}",
                     "status": d.status if (d.status != "agreed" or d.seller_accepted) else "waiting_for_seller",
                     "inr": d.final_price_inr if d.status in ("agreed", "approved", "settled") else None, "recorded": False})
        if d.status == "settled" and d.settlement:
            feed.append({**base, "kind": "sale", "at": d.settlement.settled_at, "who": name(d.seller_id),
                         "text": f"{name(d.seller_id)} sold {what} to {name(d.buyer_id)}",
                         "inr": d.final_price_inr, "kg": t["mass_diverted_kg"] if t else None,
                         "co2e_kg": t["co2_avoided_kg"] if t else None, "recorded": bool(es), "lines": lines(es)})

    # Shared pickups
    for b in store.list_bundles():
        es = by_source.get(b.id, [])
        if b.status != "accepted" or not es:
            continue
        t = totals(es)
        feed.append({"kind": "pickup", "at": min(e.created_at for e in es), "who": name(b.dealer_id),
                     "text": f"{name(b.dealer_id)} collected {len(b.item_ids)} things from {len(b.route)} homes in one trip",
                     "kg": t["mass_diverted_kg"], "co2e_kg": t["co2_avoided_kg"], "inr": b.total_value_inr,
                     "recorded": True, "lines": lines(es), "item_ids": b.item_ids,
                     "sample": any(item_by_id[x].synthetic for x in b.item_ids if x in item_by_id)})

    feed.sort(key=lambda f: f["at"], reverse=True)

    # Breakdown by material
    mats: dict[str, dict[str, float]] = defaultdict(lambda: {"kg": 0.0, "co2e_kg": 0.0})
    for e in entries:
        mats[e.material]["kg"] += e.mass_kg
        mats[e.material]["co2e_kg"] += e.co2_avoided_kg
    by_material = sorted(({"material": m, "kg": round(v["kg"], 1), "co2e_kg": round(v["co2e_kg"], 1)} for m, v in mats.items()),
                         key=lambda r: r["co2e_kg"], reverse=True)

    waiting = [i for i in items if i.status == "available"]
    deals = store.list_deals()
    return {
        "totals": totals(entries),
        "waiting": {"items": len(waiting), "kg": round(sum(sum(c.est_weight_kg for c in i.components) * max(i.count, 1) for i in waiting), 1),
                    "co2e_kg": round(sum(i.co2_avoided_kg or 0 for i in waiting), 1)},
        "counts": {
            "listed": len(items), "handovers": sum(1 for d in deals if d.kind == "handover"),
            "sales": sum(1 for d in deals if d.kind == "sale" and d.status == "settled"),
            "negotiating": sum(1 for d in deals if d.status == "negotiating"),
            "waiting_for_seller": sum(1 for d in deals if d.status == "agreed" and not d.seller_accepted),
            "people": len({i.seller_id for i in items if i.seller_id}),
        },
        "by_material": by_material,
        "feed": feed[:limit],
        "method": {
            "formula": "kg of each material × its emission factor × the share its next life avoids",
            "reuse_replaces_new": displacement("reuse"),
            "source": factor_source(),
        },
    }
