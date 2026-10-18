"""Recompute CO2e on saved items and ledger entries after the emission method changes.

Only the derived CO2e numbers change; weights, routes and everything else stay as they are.
    STORE=firestore python -m scripts.recompute_co2            # dry run: shows what would change
    STORE=firestore python -m scripts.recompute_co2 --apply    # writes the new numbers
"""

import sys

from app import ledger
from app.materials import avoided_share, emission_factor
from app.store import get_store


def main(apply: bool) -> None:
    store = get_store()
    items = store.list_items()
    changed_items = []
    for it in items:
        new = ledger.co2_avoided_for_item(it)
        if it.co2_avoided_kg != new:
            changed_items.append((it, it.co2_avoided_kg, new))
            it.co2_avoided_kg = new
    entries = store.list_ledger()
    changed_entries = []
    for e in entries:
        new = round(e.mass_kg * emission_factor(e.material) * avoided_share(e.rung.value, e.material), 3)
        if abs(e.co2_avoided_kg - new) > 1e-9:
            changed_entries.append((e, e.co2_avoided_kg, new))
            e.co2_avoided_kg = new
            e.factor_kg_per_kg = emission_factor(e.material)
    print(f"items: {len(changed_items)} of {len(items)} change; ledger entries: {len(changed_entries)} of {len(entries)} change")
    for it, old, new in changed_items[:8]:
        print(f"  {it.type}: {old} -> {new} kg CO2e")
    before = sum(old for _, old, _ in changed_entries) + sum(e.co2_avoided_kg for e in entries if e not in [c[0] for c in changed_entries])
    print(f"recorded CO2e: {before:,.1f} -> {sum(e.co2_avoided_kg for e in entries):,.1f} kg")
    if not apply:
        print("Dry run: nothing written. Add --apply to save.")
        return
    for i in range(0, len(changed_items), 400):
        store.upsert_items([c[0] for c in changed_items[i:i + 400]])
    for i in range(0, len(changed_entries), 400):
        store.add_ledger([c[0] for c in changed_entries[i:i + 400]])
    print("Saved.")


if __name__ == "__main__":
    main("--apply" in sys.argv)
