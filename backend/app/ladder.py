"""The next-life ladder: deterministic rules that pick the best feasible rung.

The model may explain a decision, but the order of the ladder and every threshold are
enforced here in code, so the outcome is predictable and testable.
"""

from __future__ import annotations

from dataclasses import dataclass

from .geo import haversine_km
from .materials import canonical_material
from .models import Component, Item, Participant, Rung

WHOLE_ITEM_BUYER_ROLES = {"buyer", "dealer", "ngo"}
PART_ROLES = {"upcycler", "repairer", "dealer"}
RECYCLER_ROLES = {"recycler", "dealer"}


@dataclass
class LadderContext:
    participants: list[Participant]
    radius_km: float = 15.0


def _matches(name: str, wanted: list[str]) -> bool:
    n = name.lower()
    return any(w.lower() in n or n in w.lower() for w in wanted if w)


def _nearest(item: Item, candidates: list[Participant]) -> Participant | None:
    if not candidates:
        return None
    return min(candidates, key=lambda p: haversine_km(item.location, p.location))


def _km(item: Item, p: Participant) -> str:
    return f"{haversine_km(item.location, p.location):.1f} km"


def route_component(item: Item, comp: Component, near: list[Participant]) -> Component:
    """Pick the best destination for one component of an item that will not stay whole."""
    material = canonical_material(comp.material)
    out = comp.model_copy()

    parts_takers = [
        p for p in near
        if p.role in PART_ROLES
        and (_matches(comp.name, p.accepts_types) or (p.role == "upcycler" and material in p.accepts_materials))
    ]
    if (dest := _nearest(item, parts_takers)) is not None:
        out.next_life, out.destination_id = Rung.HARVEST_PARTS, dest.id
        out.reason = f"{dest.name} ({_km(item, dest)}) takes {comp.name} as a usable part"
        return out

    recyclers = [p for p in near if p.role in RECYCLER_ROLES and material in p.accepts_materials]
    if (dest := _nearest(item, recyclers)) is not None:
        out.next_life, out.destination_id = Rung.RECYCLE, dest.id
        out.reason = f"{dest.name} ({_km(item, dest)}) recycles {material}"
        return out

    energy = [
        p for p in near
        if p.role == "energy_facility" and (material in p.accepts_materials or "any" in p.accepts_materials)
    ]
    if (dest := _nearest(item, energy)) is not None:
        out.next_life, out.destination_id = Rung.RECOVER_ENERGY, dest.id
        out.reason = f"No recycler for {material} nearby; {dest.name} recovers energy from it"
        return out

    out.next_life, out.destination_id = Rung.SAFE_DISPOSAL, None
    out.reason = f"No reuse, recycling or energy option for {material} within range"
    return out


def decide(item: Item, ctx: LadderContext) -> Item:
    """Return a copy of the item with next_life, destination and per-component routing filled."""
    out = item.model_copy(deep=True)
    near = [
        p for p in ctx.participants
        if p.id != item.seller_id and haversine_km(item.location, p.location) <= ctx.radius_km
    ]

    # Hazards never go to reuse.
    if item.hazards:
        handler = _nearest(item, [p for p in near if p.role == "hazard_handler"])
        out.next_life = Rung.SAFE_DISPOSAL
        out.destination_id = handler.id if handler else None
        out.next_life_reason = (
            f"Suspected hazard ({', '.join(item.hazards)}): professional testing required; "
            + (f"routed to licensed handler {handler.name}" if handler else "no licensed handler found nearby")
        )
        for c in out.components:
            c.next_life, c.destination_id, c.reason = Rung.SAFE_DISPOSAL, out.destination_id, "Hazard"
        out.recovered_fraction = 0.0
        return out

    # 1. Reuse as-is
    if item.condition in ("A", "B"):
        takers = [p for p in near if p.role in WHOLE_ITEM_BUYER_ROLES and _matches(item.type, p.accepts_types)]
        if (dest := _nearest(item, takers)) is not None:
            return _whole(out, Rung.REUSE, dest, f"Condition {item.condition}; {dest.name} ({_km(item, dest)}) wants {item.type}")

    # 2. Repair, only if it pays
    repairers = [p for p in near if p.role == "repairer" and _matches(item.type, p.accepts_types)]
    repair_note = ""
    if repairers and item.repair_cost_inr is not None and item.value_max_inr is not None:
        dest = _nearest(item, repairers)
        if item.repair_cost_inr < item.value_max_inr:
            return _whole(
                out, Rung.REPAIR, dest,
                f"{dest.name} ({_km(item, dest)}) can repair it for about ₹{item.repair_cost_inr:,.0f}, "
                f"less than its repaired value of up to ₹{item.value_max_inr:,.0f}",
            )
        repair_note = (
            f"Repair (₹{item.repair_cost_inr:,.0f}) would cost more than the item is worth "
            f"(up to ₹{item.value_max_inr:,.0f}). "
        )

    # 3. Upcycle the whole item
    upcyclers = [p for p in near if p.role == "upcycler" and _matches(item.type, p.accepts_types)]
    if (dest := _nearest(item, upcyclers)) is not None:
        return _whole(out, Rung.UPCYCLE, dest, repair_note + f"{dest.name} ({_km(item, dest)}) upcycles {item.type}")

    # 4-7. Take it apart and route each component
    out.components = [route_component(item, c, near) for c in item.components]
    order = list(Rung)
    rungs = [c.next_life for c in out.components if c.next_life is not None]
    out.next_life = min(rungs, key=order.index) if rungs else Rung.SAFE_DISPOSAL
    out.destination_id = None
    out.recovered_fraction = _recovered(out)
    out.next_life_reason = repair_note + "Taken apart: " + "; ".join(
        f"{c.name} → {c.next_life.value.replace('_', ' ')}" for c in out.components if c.next_life
    )
    return out


def _whole(item: Item, rung: Rung, dest: Participant, reason: str) -> Item:
    item.next_life, item.destination_id, item.next_life_reason = rung, dest.id, reason
    for c in item.components:
        c.next_life, c.destination_id, c.reason = rung, dest.id, "Stays with the item"
    item.recovered_fraction = 1.0
    return item


def _recovered(item: Item) -> float:
    total = sum(c.est_weight_kg for c in item.components)
    if total <= 0:
        return 0.0
    kept = sum(c.est_weight_kg for c in item.components if c.next_life != Rung.SAFE_DISPOSAL)
    return round(kept / total, 3)
