"""Each account's circular standing: a level earned from what it has given a next life (handed over
or sold) and taken in, counted only from settled ledger entries. Shown on profiles and certified
as a PDF. No prices are involved beyond money earned, which the person sees anyway."""

from __future__ import annotations

from typing import Any

from .models import Deal, Item, LedgerEntry, Participant, Rung

# (name, items needed, or kilograms needed). Either threshold earns the level.
LEVELS = [
    ("Circular starter", 1, 0.0),
    ("Circular contributor", 5, 100.0),
    ("Circular champion", 20, 1000.0),
]


def _sum(entries: list[LedgerEntry]) -> dict[str, float]:
    kept = sum(e.mass_kg for e in entries if e.rung != Rung.SAFE_DISPOSAL)
    return {"items": len({e.item_id for e in entries}), "kg": round(kept, 1),
            "co2e_kg": round(sum(e.co2_avoided_kg for e in entries), 1)}


def standing(person: Participant, items: list[Item], deals: list[Deal], entries: list[LedgerEntry]) -> dict[str, Any]:
    """What this account has done for the circular economy, and the level it has earned."""
    mine = {i.id for i in items if i.seller_id == person.id}
    settled = [d for d in deals if d.status == "settled"]
    taken_deals = {d.id for d in settled if d.buyer_id == person.id}
    gave = _sum([e for e in entries if e.item_id in mine])
    took = _sum([e for e in entries if e.source_id in taken_deals])
    sold = [d for d in settled if d.seller_id == person.id and d.kind == "sale"]
    handed = [d for d in settled if d.seller_id == person.id and d.kind == "handover"]
    count, kg = gave["items"] + took["items"], gave["kg"] + took["kg"]

    level, nxt = None, None
    for name, need_items, need_kg in LEVELS:
        if count >= need_items or (need_kg and kg >= need_kg):
            level = name
        elif nxt is None:
            nxt = {"name": name, "items": need_items, "kg": need_kg,
                   "to_go": f"{max(need_items - count, 0)} more {'item' if need_items - count == 1 else 'items'}"
                            + (f" or {need_kg - kg:,.0f} kg more" if need_kg else "")}
    return {
        "person_id": person.id, "name": person.name, "level": level, "next": nxt,
        "gave": gave, "took": took, "sales": len(sold), "handovers": len(handed),
        "earned_inr": round(sum(d.final_price_inr or 0 for d in sold)),
        "co2e_kg": round(gave["co2e_kg"] + took["co2e_kg"], 1), "kg": round(kg, 1), "items": count,
        "synthetic": person.synthetic,
    }
