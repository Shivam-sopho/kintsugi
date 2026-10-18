"""Google Maps Platform: geocoding and finding destinations (Places API, New).

Live calls need MAPS_API_KEY with the Geocoding API and Places API (New) enabled.
Not yet exercised against the live API.
"""

from __future__ import annotations

import logging
from typing import Optional

import httpx

from .config import Settings
from .models import GeoPoint, Participant

log = logging.getLogger(__name__)

# What to search for, per role, and what that kind of place usually accepts.
DESTINATION_QUERIES: dict[str, tuple[str, list[str], list[str]]] = {
    "dealer": ("scrap dealer", ["door", "window"], ["steel", "copper", "aluminium", "paper", "plastic"]),
    "repairer": ("furniture repair carpenter", ["chair", "table", "door"], []),
    "upcycler": ("upcycled furniture studio", ["wooden frame"], ["wood", "glass"]),
    "recycler": ("recycling centre", [], ["plastic", "paper", "glass", "textile"]),
    "composter": ("biogas plant or composting centre", [], ["organic"]),
    "government": ("dry waste collection centre", [], ["paper", "plastic", "glass", "textile", "aluminium", "steel"]),
}


async def geocode(address: str, settings: Settings) -> Optional[GeoPoint]:
    if settings.mock_mode or not settings.maps_api_key:
        return None
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            "https://maps.googleapis.com/maps/api/geocode/json",
            params={"address": address, "key": settings.maps_api_key},
        )
        data = r.json()
    if data.get("results"):
        loc = data["results"][0]["geometry"]["location"]
        return GeoPoint(lat=loc["lat"], lng=loc["lng"])
    log.warning("Geocoding found nothing for %r: %s", address, data.get("status"))
    return None


async def find_destinations(near: GeoPoint, settings: Settings, radius_m: int = 8000) -> list[Participant]:
    """Real nearby businesses as participants (live mode only)."""
    if settings.mock_mode or not settings.maps_api_key:
        return []
    found: list[Participant] = []
    async with httpx.AsyncClient(timeout=10) as client:
        for role, (query, types, materials) in DESTINATION_QUERIES.items():
            r = await client.post(
                "https://places.googleapis.com/v1/places:searchText",
                headers={
                    "X-Goog-Api-Key": settings.maps_api_key,
                    "X-Goog-FieldMask": "places.id,places.displayName,places.location,places.formattedAddress",
                },
                json={
                    "textQuery": query,
                    "maxResultCount": 3,
                    "locationBias": {
                        "circle": {"center": {"latitude": near.lat, "longitude": near.lng}, "radius": radius_m}
                    },
                },
            )
            for place in r.json().get("places", []):
                found.append(
                    Participant(
                        id=f"plc_{place['id'][-12:]}",
                        name=place.get("displayName", {}).get("text", query),
                        role=role,  # type: ignore[arg-type]
                        language="en",
                        location=GeoPoint(lat=place["location"]["latitude"], lng=place["location"]["longitude"]),
                        accepts_types=types,
                        accepts_materials=materials,
                        synthetic=False,
                        place_id=place["id"],
                    )
                )
    return found
