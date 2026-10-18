"""A live market: sample buyers' agents open negotiations as soon as something they want is listed;
nothing is sold until the seller accepts, and the buyer's agent then approves within its limit."""

import asyncio

from app import agents, main
from app.llm import get_llm
from app.store import get_store

from .test_features import client, scan, wait  # noqa: F401  (pytest fixture and helpers)


def _listed_with_offers(client, monkeypatch):
    monkeypatch.setattr(main.settings, "live_market", True)
    made = asyncio.run(agents.seed_market(get_store(), get_llm()))
    assert made and all(r.synthetic and r.auto_approve for r in made)
    assert asyncio.run(agents.seed_market(get_store(), get_llm())) == []  # only once
    data = {"kind": "building", "name": "Old office", "lat": 12.9352, "lng": 77.6245, "seller_id": "ppl_me"}
    job = wait(client, client.post("/api/scan", data=data, files=[("files", ("walk.mp4", b"fake", "video/mp4"))]).json()["id"])
    assert job["result"]["item_ids"] and job["result"]["market_job_id"]
    market = wait(client, job["result"]["market_job_id"], timeout=60)
    deals = [client.get(f"/api/deals/{d}").json() for d in market["result"]["deal_ids"]]
    agreed = [d for d in deals if d["status"] == "agreed"]
    assert agreed, [d["status"] for d in deals]
    assert all(not d["seller_accepted"] and d["transcript"] and d["final_price_inr"] > 0 for d in agreed)
    return agreed


def test_buyers_agents_negotiate_and_the_seller_accepts(client, monkeypatch):
    deal = _listed_with_offers(client, monkeypatch)[0]
    assert client.post(f"/api/deals/{deal['id']}/approve").status_code == 400  # the seller hasn't said yes
    done = client.post(f"/api/deals/{deal['id']}/accept").json()
    assert done["seller_accepted"] and done["status"] == "settled"  # the buyer approves within its limit
    assert all(client.get(f"/api/items/{i}").json()["status"] == "sold" for i in done["item_ids"])


def test_the_seller_can_decline_and_the_item_is_listed_again(client, monkeypatch):
    deal = _listed_with_offers(client, monkeypatch)[0]
    out = client.post(f"/api/deals/{deal['id']}/decline").json()
    assert out["status"] == "no_deal"
    assert all(client.get(f"/api/items/{i}").json()["status"] == "available" for i in out["item_ids"])


def test_an_item_in_a_negotiation_can_still_be_confirmed_but_not_changed(client, monkeypatch):
    deal = _listed_with_offers(client, monkeypatch)[0]
    item_id = deal["item_ids"][0]
    assert client.patch(f"/api/items/{item_id}", json={"verified": True}).json()["verified"] is True
    r = client.patch(f"/api/items/{item_id}", json={"count": 2})
    assert r.status_code == 400 and "decline" in r.json()["detail"]
