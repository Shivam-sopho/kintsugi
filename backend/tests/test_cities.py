"""Sample cities across Asia-Pacific: each has its own takers, and its listed things are routed to
takers in the same city by the same rules, with their impact counted."""

import asyncio

from app import agents
from app.config import get_settings
from app.demo import cities
from app.geo import haversine_km
from app.llm.mock import MockLLM
from app.store import get_store

from .test_features import client  # noqa: F401  (pytest fixture)


def test_every_city_routes_its_things_to_its_own_takers(client):
    store, settings = get_store(), get_settings()
    n = asyncio.run(agents.seed_cities(store, MockLLM(settings), settings))
    assert n == len(cities.CITIES) * sum(len(t) for _, _, t in cities.HOMES)
    assert asyncio.run(agents.seed_cities(store, MockLLM(settings), settings)) == 0  # only once
    people = {p.id: p for p in store.list_participants()}
    for c in cities.CITIES:
        items = [i for i in store.list_items() if i.site_id.startswith(f"site_{c['id']}_")]
        assert items and all(i.synthetic and i.next_life for i in items)
        dests = {d for i in items for d in [i.destination_id, *(x.destination_id for x in i.components)] if d}
        assert dests and all(d.startswith(f"ppl_{c['id']}_") for d in dests), c["name"]
        assert all(haversine_km(i.location, people[d].location) < 15 for i in items for d in [i.destination_id] if d)
        waste = next(i for i in items if i.type == "kitchen and garden waste")
        assert waste.next_life.value == "compost" and waste.co2_avoided_kg > 0


def test_the_city_picker_lists_bengaluru_first(client):
    out = client.get("/api/cities").json()
    assert out[0]["name"] == "Bengaluru" and {"Tokyo", "Singapore", "Jakarta", "Sydney"} <= {c["name"] for c in out}
