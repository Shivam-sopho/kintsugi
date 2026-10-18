"""Autopilot: sellers let their agent sell, buyers save standing requests, deals settle within limits."""

from app.store import get_store

from .test_features import client, scan, wait  # noqa: F401  (pytest fixture and helpers)

ANANYA = "ppl_ananya"  # a sample buyer


def _sellable(client):
    """A scanned building lot with no hazards, priced, with the seller's lowest price set."""
    items = [i for i in scan(client) if not i["hazards"] and i["value_max_inr"]]
    it = items[0]
    floor = round(it["value_min_inr"] * it["count"] * 0.8)
    assert client.patch(f"/api/items/{it['id']}", json={"floor_price_inr": floor}).status_code == 200
    return it


def _request(client, query, **kw):
    body = {"buyer_id": ANANYA, "query": query, "lat": 12.9352, "lng": 77.6245, "radius_km": 10, **kw}
    return wait(client, client.post("/api/requests", json=body).json()["id"])


def test_autopilot_needs_a_lowest_price_and_never_takes_hazards(client):
    items = scan(client)
    plain = next(i for i in items if not i["hazards"])
    r = client.post(f"/api/items/{plain['id']}/autopilot", json={"on": True})
    assert r.status_code == 400 and "lowest price" in r.json()["detail"]
    hazard = next((i for i in items if i["hazards"]), None)
    if hazard:
        client.patch(f"/api/items/{hazard['id']}", json={"floor_price_inr": 100})
        r = client.post(f"/api/items/{hazard['id']}/autopilot", json={"on": True})
        assert r.status_code == 400 and "licensed handler" in r.json()["detail"]


def test_both_sides_on_autopilot_settle_without_a_tap(client):
    it = _sellable(client)
    wait(client, client.post(f"/api/items/{it['id']}/autopilot", json={"on": True}).json()["id"])
    job = _request(client, it["type"], cap_inr=it["value_max_inr"] * it["count"] * 2, auto_approve=True)
    deals = job["result"]["deal_ids"]
    assert deals, "a matching request should start a deal on its own"
    deal = client.get(f"/api/deals/{deals[0]}").json()
    assert deal["autopilot"] and deal["status"] == "settled"
    assert client.get(f"/api/certificate/{deal['id']}").status_code == 200


def test_without_seller_autopilot_the_buyer_is_only_told(client):
    it = _sellable(client)
    job = _request(client, it["type"])
    assert job["result"]["deal_ids"] == []
    events = client.get(f"/api/jobs/{job['id']}/events").json()
    assert any(e["step"] == "match" and it["type"] in e["message"] for e in events)
    assert client.get(f"/api/items/{it['id']}").json()["status"] == "available"


def test_a_new_scan_is_matched_against_saved_requests(client):
    first = _sellable(client)
    _request(client, first["type"], cap_inr=1_000_000, auto_approve=True)
    # The seller turns Autopilot on later: the saved request is matched straight away.
    job = wait(client, client.post(f"/api/items/{first['id']}/autopilot", json={"on": True}).json()["id"])
    assert job["result"]["deal_ids"]


def test_the_buyers_highest_price_stays_private(client):
    _request(client, "teak panel door", cap_inr=4321, auto_approve=True)
    state = client.get("/api/state").text
    assert "4321" not in state and "cap_inr" not in state
    req = client.get("/api/state").json()["requests"][0]
    assert req["has_cap"] and req["auto_approve"]


def test_auto_approve_needs_a_highest_price(client):
    body = {"buyer_id": ANANYA, "query": "doors", "lat": 12.9, "lng": 77.6, "auto_approve": True}
    assert client.post("/api/requests", json=body).status_code == 400
    assert get_store().list_requests() == []


def test_running_the_demo_never_deletes_peoples_data(client):
    """Judges and testers share one database: the demo clears only its own sample data."""
    mine = scan(client, kind="home", seller_id="ppl_me")
    _request(client, "teak panel door")
    demo_items = []
    for _ in range(2):  # twice: the second run replaces the first run's sample data, nothing more
        wait(client, client.post("/api/judge-mode").json()["id"])
        state = client.get("/api/state").json()
        demo_items.append(len([i for i in state["items"] if i["site_id"] in ("site_home_hsr", "site_office_kor")]))
    ids = {i["id"] for i in state["items"]}
    assert {i["id"] for i in mine} <= ids, "a person's own listing must survive the demo"
    assert state["requests"], "standing requests must survive the demo"
    assert demo_items[0] == demo_items[1] > 0, "the demo must not pile up duplicate sample data"
