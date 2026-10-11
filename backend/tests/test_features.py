"""Features that close the loop with people: corrections, offers, voice, evidence, privacy."""

import time

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

from app import agents
from app.demo import fixtures
from app.evidence import blur_faces, frames_at
from app.main import app
from app.store import get_store


@pytest.fixture
def client():
    store = get_store()
    store.reset()
    agents.seed_participants(store)
    store.upsert_predictions(fixtures.predictions())
    with TestClient(app) as c:
        yield c


def wait(client, job_id, timeout=30):
    end = time.time() + timeout
    while time.time() < end:
        job = client.get(f"/api/jobs/{job_id}").json()
        if job["status"] in ("done", "error"):
            assert job["status"] == "done", job.get("error")
            return job
        time.sleep(0.05)
    raise AssertionError("timed out")


def scan(client, kind="building", files=None, **form):
    data = {"kind": kind, "name": "Test", "lat": 12.9352, "lng": 77.6245, "seller_id": "ppl_ramesh", **form}
    files = files or [("files", ("walk.mp4", b"fake", "video/mp4"))]
    job = wait(client, client.post("/api/scan", data=data, files=files).json()["id"])
    return [client.get(f"/api/items/{i}").json() for i in job["result"]["item_ids"]]


def test_person_can_confirm_and_correct_an_item(client):
    items = scan(client)
    hollow = next(i for i in items if "hollow" in i["type"])
    assert hollow["verified"] is False
    out = client.patch(f"/api/items/{hollow['id']}", json={"count": 24, "condition": "C"}).json()
    assert out["verified"] is True and out["needs_verification"] is False
    assert out["count"] == 24 and out["condition"] == "C"
    assert client.patch(f"/api/items/{hollow['id']}", json={"condition": "Z"}).status_code == 400


def test_seller_floor_is_private_and_enforced(client):
    items = scan(client)
    door = next(i for i in items if "door" in i["type"])
    out = client.patch(f"/api/items/{door['id']}", json={"floor_price_inr": 60000}).json()
    assert out["has_floor_price"] is True and "floor_price_inr" not in out
    assert all("floor_price_inr" not in i for i in client.get("/api/state").json()["items"])
    # The doors' floor (60,000) is above the café's cap (30,000), so the agents can't agree.
    job = wait(client, client.post(f"/api/items/{door['id']}/offer").json()["id"])
    deal = client.get(f"/api/deals/{job['result']['deal_id']}").json()
    assert deal["status"] == "no_deal"


def test_offer_from_passport_starts_a_deal_with_the_ladders_buyer(client):
    items = scan(client)
    door = next(i for i in items if "door" in i["type"])
    job = wait(client, client.post(f"/api/items/{door['id']}/offer").json()["id"])
    deal = client.get(f"/api/deals/{job['result']['deal_id']}").json()
    assert deal["buyer_id"] == door["destination_id"]
    assert deal["item_ids"] == [door["id"]] and deal["status"] == "agreed"


def test_voice_input_and_voice_note_listing(client):
    r = client.post("/api/transcribe", data={"hint": "floor"}, files={"file": ("v.webm", b"x", "audio/webm")}).json()
    assert r["language"] == "hi" and r["amount_inr"] == 25000
    items = scan(client, files=[("files", ("note.webm", b"x", "audio/webm"))])
    assert items[0]["type"] == "teak window frame" and items[0]["needs_verification"] is True


def test_home_scan_gets_take_apart_steps_in_owners_language(client):
    items = scan(client, kind="home", lat=12.9116, lng=77.6474, seller_id="ppl_home")
    chair = items[0]
    assert len(chair["take_apart"]["hi"]) >= 4 and len(chair["take_apart"]["en"]) >= 4


def test_home_location_is_coarse_until_sold(client):
    scan(client, kind="home", lat=12.91163, lng=77.64741, seller_id="ppl_home")
    st = client.get("/api/state").json()
    home = next(s for s in st["sites"] if s["kind"] == "home")
    assert round(home["location"]["lat"] / 0.005, 6).is_integer()


def test_oracle_does_not_duplicate_known_notices(client):
    before = len(client.get("/api/state").json()["predictions"])
    wait(client, client.post("/api/oracle", files={"file": ("n.pdf", b"%PDF", "application/pdf")}).json()["id"])
    assert len(client.get("/api/state").json()["predictions"]) == before


def test_certificate_in_hindi_and_kannada(client):
    job = wait(client, client.post("/api/judge-mode").json()["id"])
    deal_id = job["result"]["deal_id"]
    assert "प्रमाणपत्र" in client.get(f"/api/certificate/{deal_id}?lang=hi").text
    assert "ಪ್ರಮಾಣಪತ್ರ" in client.get(f"/api/certificate/{deal_id}?lang=kn").text


def test_skip_flag_reaches_the_emitter(client):
    job = client.post("/api/judge-mode").json()
    assert client.post(f"/api/jobs/{job['id']}/skip").json()["ok"]
    em = agents.Emitter(get_store(), job["id"], delay=5)
    assert em._skipping() is True
    wait(client, job["id"])


def test_evidence_frames_from_a_real_video(client, tmp_path):
    path = tmp_path / "clip.mp4"
    vw = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"mp4v"), 10, (320, 240))
    for i in range(60):
        frame = np.full((240, 320, 3), (i * 4) % 255, dtype=np.uint8)
        vw.write(frame)
    vw.release()
    data = path.read_bytes()
    assert len(frames_at(data, [1.0, 4.0])) == 2
    items = scan(client, files=[("files", ("clip.mp4", data, "video/mp4"))])
    with_ev = [i for i in items if i["evidence"]]
    assert with_ev
    img = client.get(f"/api/evidence/{with_ev[0]['evidence'][0]}")
    assert img.status_code == 200 and img.headers["content-type"] == "image/jpeg"


def test_blur_keeps_image_shape():
    img = np.random.randint(0, 255, (200, 300, 3), dtype=np.uint8)
    out, n = blur_faces(img)
    assert out.shape == img.shape and n >= 0
