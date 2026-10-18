"""The live ledger shows everything that happened, newest first, with each recorded impact traced to
its materials and factors, and never a private price."""

from .test_features import client, scan, wait  # noqa: F401  (pytest fixture and helpers)


def test_the_live_ledger_records_listings_and_handovers(client):
    item = next(i for i in scan(client, kind="home", seller_id="ppl_me") if i["destination_id"] or i["components"][0]["destination_id"])
    client.patch(f"/api/items/{item['id']}", json={"floor_price_inr": 98765})
    wait(client, client.post(f"/api/items/{item['id']}/handover").json()["id"])
    live = client.get("/api/ledger/live").json()
    kinds = [f["kind"] for f in live["feed"]]
    assert "handover" in kinds and "listed" in kinds
    assert live["feed"] == sorted(live["feed"], key=lambda f: f["at"], reverse=True)
    ho = next(f for f in live["feed"] if f["kind"] == "handover")
    assert ho["recorded"] and ho["lines"] and ho["co2e_kg"] > 0
    line = ho["lines"][0]
    assert abs(line["kg"] * line["factor"] * line["share"] - line["co2e_kg"]) < 0.2  # every number traces back
    assert live["counts"]["handovers"] >= 1 and live["totals"]["co2_avoided_kg"] > 0
    assert "98765" not in client.get("/api/ledger/live").text
