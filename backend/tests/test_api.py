import time

from fastapi.testclient import TestClient

from app.main import app


def _wait(client, job_id, timeout=30):
    end = time.time() + timeout
    while time.time() < end:
        job = client.get(f"/api/jobs/{job_id}").json()
        if job["status"] in ("done", "error"):
            return job
        time.sleep(0.1)
    raise AssertionError("job timed out")


def test_judge_mode_runs_the_whole_story():
    with TestClient(app) as client:
        assert client.get("/api/health").json()["mock_mode"] is True
        job = client.post("/api/judge-mode").json()
        job = _wait(client, job["id"])
        assert job["status"] == "done", job.get("error")

        deal = client.get(f"/api/deals/{job['result']['deal_id']}").json()
        assert deal["status"] == "settled"
        assert deal["settlement"]["label"].startswith("SANDBOX")
        assert 24000 <= deal["final_price_inr"] <= 30000

        state = client.get("/api/state").json()
        assert state["totals"]["co2_avoided_kg"] > 0
        assert any(b["status"] == "accepted" for b in state["bundles"])
        assert len(state["predictions"]) >= 4
        assert all("budget_cap_inr" not in p for p in state["participants"])  # private limits stay private

        events = client.get(f"/api/jobs/{job['id']}/events").json()
        agents_seen = {e["agent"] for e in events}
        assert {"oracle", "scout", "architect", "seller", "buyer", "bundler", "ledger"} <= agents_seen

        cert = client.get(f"/api/certificate/{deal['id']}")
        assert cert.status_code == 200 and "CO2e" in cert.text


def test_scan_upload_and_search_cross_language():
    with TestClient(app) as client:
        job = client.post(
            "/api/scan",
            data={"kind": "building", "name": "Test site", "lat": 12.935, "lng": 77.6245, "seller_id": "ppl_ramesh"},
            files=[("files", ("walk.mp4", b"fake", "video/mp4"))],
        ).json()
        job = _wait(client, job["id"])
        assert job["status"] == "done", job.get("error")
        res = client.post("/api/search", json={"query": "सागौन के दरवाज़े", "lat": 12.97, "lng": 77.64}).json()
        assert res and "door" in res[0]["item"]["type"]


def test_narrated_judge_mode_runs_slower_so_the_voice_keeps_up(monkeypatch):
    from app import main

    seen = {}

    async def fake_judge(store, llm, settings, job_id):
        seen["delay"] = settings.demo_step_delay
        return {}

    monkeypatch.setattr(main.agents, "judge_mode", fake_judge)
    monkeypatch.setattr(main.settings, "demo_step_delay", 0.6)
    with TestClient(app) as client:
        _wait(client, client.post("/api/judge-mode?narrated=true").json()["id"])
    assert round(seen["delay"], 2) == round(0.6 * main.NARRATED_PACE, 2)


def test_a_finished_demo_is_kept_to_replay_from_the_start():
    with TestClient(app) as client:
        job = _wait(client, client.post("/api/judge-mode").json()["id"])
        rec = client.get("/api/demo/recording").json()
        assert rec["result"]["deal_id"] == job["result"]["deal_id"]
        assert rec["events"][0]["agent"] == "system" and len(rec["events"]) > 30
        assert {"oracle", "scout", "ledger"} <= {e["agent"] for e in rec["events"]}
