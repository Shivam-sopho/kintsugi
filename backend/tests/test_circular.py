"""Every route counts: explanations of what becomes of an item, and hand-overs without money."""

from app.store import get_store

from .test_features import client, scan, wait  # noqa: F401  (pytest fixture and helpers)


def test_what_becomes_of_it_explains_the_decided_routes_and_is_cached(client):
    it = next(i for i in scan(client) if i["components"])
    first = client.get(f"/api/items/{it['id']}/explain?lang=en").json()
    assert first["headline"] and first["parts"] and first["you_can"] and first["why"]
    assert len(first["parts"]) == len(it["components"])
    from app.agents import EXPLAIN_VERSION

    assert get_store().get_item(it["id"]).explanation[f"{EXPLAIN_VERSION}:en"] == first  # cached for the next viewer
    assert client.get(f"/api/items/{it['id']}/explain?lang=en").json() == first


def test_hand_over_completes_the_journey_without_money(client):
    items = scan(client)
    it = next(i for i in items if not i["hazards"] and (i["destination_id"] or any(c["destination_id"] for c in i["components"])))
    job = client.post(f"/api/items/{it['id']}/handover").json()
    assert job["status"] == "done" and job["result"]["kg"] > 0 and job["result"]["co2e_kg"] >= 0  # at once, no waiting
    deal = client.get(f"/api/deals/{job['result']['deal_id']}").json()
    assert deal["kind"] == "handover" and deal["status"] == "settled" and deal["final_price_inr"] == 0
    assert client.get(f"/api/items/{it['id']}").json()["status"] == "routed"
    assert client.get("/api/ledger").json()["totals"]["mass_diverted_kg"] > 0
    cert = client.get(f"/api/certificate/{deal['id']}").text
    assert "no money involved" in cert
    again = client.post(f"/api/items/{it['id']}/handover")
    assert again.status_code == 400 and "already" in again.json()["detail"]


def test_hazards_are_handed_to_a_licensed_handler(client):
    hazard = next((i for i in scan(client) if i["hazards"]), None)
    if hazard is None:
        return
    job = wait(client, client.post(f"/api/items/{hazard['id']}/handover").json()["id"])
    deal = client.get(f"/api/deals/{job['result']['deal_id']}").json()
    taker = next(p for p in client.get("/api/state").json()["participants"] if p["id"] == deal["buyer_id"])
    assert taker["role"] == "hazard_handler"


def wait_error(client, job_id):
    import time
    for _ in range(200):
        j = client.get(f"/api/jobs/{job_id}").json()
        if j["status"] == "error":
            return j["error"]
        if j["status"] == "done":
            raise AssertionError("expected the second hand-over to be refused")
        time.sleep(0.05)
    raise AssertionError("timed out")
