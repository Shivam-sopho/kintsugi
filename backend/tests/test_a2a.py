"""The seller agent is reachable over A2A, and deals work with A2A on or off."""

import time

from fastapi.testclient import TestClient

from app import agents
from app.config import get_settings
from app.demo import fixtures
from app.main import app
from app.store import get_store


def _fresh():
    store = get_store()
    store.reset()
    agents.seed_participants(store)
    store.upsert_predictions(fixtures.predictions())


def _wait(c, job_id):
    for _ in range(600):
        job = c.get(f"/api/jobs/{job_id}").json()
        if job["status"] in ("done", "error"):
            return job
        time.sleep(0.05)
    raise AssertionError("timed out")


def test_agent_card_is_published():
    with TestClient(app) as c:
        card = c.get("/a2a/seller/.well-known/agent-card.json").json()
        assert card["name"] == "Kintsugi seller agent"
        assert card["skills"][0]["id"] == "negotiate_lot"
        assert card["supportedInterfaces"][0]["url"].endswith("/a2a/seller")


def test_demo_deal_runs_over_a2a_and_no_limit_leaks_in_notes():
    _fresh()
    with TestClient(app) as c:
        job = _wait(c, c.post("/api/judge-mode").json()["id"])
        assert job["status"] == "done", job.get("error")
        events = c.get(f"/api/jobs/{job['id']}/events").json()
        assert any(e["step"] == "a2a" for e in events)
        deal = c.get(f"/api/deals/{job['result']['deal_id']}").json()
        assert deal["status"] == "settled"
        for t in deal["transcript"]:
            assert "of ₹" not in t["guardrail_note"]  # notes say a limit held, never what it is


def test_deals_still_work_with_a2a_off(monkeypatch):
    _fresh()
    monkeypatch.setattr(get_settings(), "a2a_enabled", False)
    with TestClient(app) as c:
        job = _wait(c, c.post("/api/scan", data={"kind": "building", "name": "T", "lat": 12.9352, "lng": 77.6245,
                                                  "seller_id": "ppl_ramesh"},
                              files=[("files", ("w.mp4", b"x", "video/mp4"))]).json()["id"])
        door = next(i for i in job["result"]["item_ids"] if "door" in c.get(f"/api/items/{i}").json()["type"])
        deal_job = _wait(c, c.post(f"/api/items/{door}/offer").json()["id"])
        events = c.get(f"/api/jobs/{deal_job['id']}/events").json()
        assert not any(e["step"] == "a2a" for e in events)
        assert c.get(f"/api/deals/{deal_job['result']['deal_id']}").json()["status"] == "agreed"
