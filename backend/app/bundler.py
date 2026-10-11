"""Bundle low-value items from nearby homes into one pickup a dealer will accept."""

from __future__ import annotations

import json
from functools import lru_cache

from .geo import haversine_km
from .materials import DATA_DIR, canonical_material
from .models import Bundle, GeoPoint, Item, Participant, Rung, Site


@lru_cache
def _rates() -> dict[str, float]:
    return json.loads((DATA_DIR / "scrap_rates.json").read_text(encoding="utf-8"))["rates_inr_per_kg"]


def scrap_value(item: Item, dealer_id: str) -> tuple[float, float]:
    """Value and weight of the parts of an item routed to this dealer."""
    value = weight = 0.0
    for c in item.components:
        if c.destination_id == dealer_id and c.next_life in (Rung.RECYCLE, Rung.HARVEST_PARTS):
            kg = c.est_weight_kg * max(item.count, 1)
            weight += kg
            value += kg * _rates().get(canonical_material(c.material), 0.0)
    return round(value, 2), round(weight, 3)


def _route(start: GeoPoint, sites: list[Site]) -> list[str]:
    """Nearest-neighbour pickup order starting from the dealer."""
    remaining, here, order = list(sites), start, []
    while remaining:
        nxt = min(remaining, key=lambda s: haversine_km(here, s.location))
        order.append(nxt.id)
        here = nxt.location
        remaining.remove(nxt)
    return order


def propose_bundles(items: list[Item], dealers: list[Participant], sites: dict[str, Site]) -> list[Bundle]:
    bundles = []
    for dealer in dealers:
        picked, total_value, total_weight = [], 0.0, 0.0
        for it in items:
            site = sites.get(it.site_id)
            if not site or site.kind != "home" or it.status != "available":
                continue
            value, weight = scrap_value(it, dealer.id)
            if weight > 0:
                picked.append(it)
                total_value += value
                total_weight += weight
        if len(picked) >= 2 and total_value >= dealer.min_bundle_value_inr:
            route_sites = list({sites[i.site_id].id: sites[i.site_id] for i in picked}.values())
            bundles.append(
                Bundle(
                    dealer_id=dealer.id,
                    item_ids=[i.id for i in picked],
                    route=_route(dealer.location, route_sites),
                    total_value_inr=round(total_value, 2),
                    total_weight_kg=round(total_weight, 2),
                )
            )
    return bundles
