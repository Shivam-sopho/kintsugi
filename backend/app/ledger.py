"""Impact accounting: mass diverted, CO2 avoided and value recovered, with sources."""

from __future__ import annotations

from .materials import canonical_material, emission_factor, factor_source, rung_credit
from .models import Item, LedgerEntry, Rung


def co2_avoided_for_item(item: Item) -> float:
    """CO2 avoided (kg) if the item follows its decided next life."""
    total = 0.0
    for c in item.components:
        rung = c.next_life or item.next_life or Rung.SAFE_DISPOSAL
        total += c.est_weight_kg * max(item.count, 1) * emission_factor(c.material) * rung_credit(rung.value)
    return round(total, 2)


def entries_for_item(item: Item, source_id: str, value_inr: float = 0.0) -> list[LedgerEntry]:
    """One ledger entry per component, so every number traces to a material and a factor."""
    weight = sum(c.est_weight_kg for c in item.components) or 1.0
    entries = []
    for c in item.components:
        rung = c.next_life or item.next_life or Rung.SAFE_DISPOSAL
        mass = c.est_weight_kg * max(item.count, 1)
        factor = emission_factor(c.material)
        entries.append(
            LedgerEntry(
                source_id=source_id,
                item_id=item.id,
                material=canonical_material(c.material),
                rung=rung,
                mass_kg=round(mass, 3),
                co2_avoided_kg=round(mass * factor * rung_credit(rung.value), 3),
                value_inr=round(value_inr * (c.est_weight_kg / weight), 2),
                factor_kg_per_kg=factor,
                factor_source=factor_source(),
            )
        )
    return entries


def totals(entries: list[LedgerEntry]) -> dict:
    diverted = sum(e.mass_kg for e in entries if e.rung != Rung.SAFE_DISPOSAL)
    material_recovered = sum(
        e.mass_kg for e in entries if e.rung not in (Rung.SAFE_DISPOSAL, Rung.RECOVER_ENERGY)
    )
    total_mass = sum(e.mass_kg for e in entries)
    by_rung: dict[str, float] = {}
    for e in entries:
        by_rung[e.rung.value] = round(by_rung.get(e.rung.value, 0.0) + e.mass_kg, 3)
    return {
        "items": len({e.item_id for e in entries}),
        "mass_total_kg": round(total_mass, 2),
        "mass_diverted_kg": round(diverted, 2),
        "material_recovered_kg": round(material_recovered, 2),
        "diverted_fraction": round(diverted / total_mass, 3) if total_mass else 0.0,
        "co2_avoided_kg": round(sum(e.co2_avoided_kg for e in entries), 2),
        "value_recovered_inr": round(sum(e.value_inr for e in entries), 2),
        "by_rung_kg": by_rung,
        "factor_source": factor_source(),
    }
