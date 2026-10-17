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


# Listen: Gemini text-to-speech, with the device's own voice as the offline fallback

def test_speak_offline_falls_back_to_device_voice(client):
    r = client.post("/api/speak", json={"text": "Unscrew the four legs.", "lang": "en"})
    assert r.status_code == 204


def test_speak_rejects_empty_and_overlong_text(client):
    assert client.post("/api/speak", json={"text": "", "lang": "en"}).status_code == 422
    assert client.post("/api/speak", json={"text": "x" * 1501, "lang": "hi"}).status_code == 422


def test_speak_serves_wav_and_caches_repeat_lines(client, monkeypatch):
    from types import SimpleNamespace

    from app import main
    from app.llm.gemini import pcm_to_wav

    calls = []

    async def fake_speech(text, lang):
        calls.append((text, lang))
        return pcm_to_wav(b"\x00\x00" * 2400)

    monkeypatch.setattr(main, "get_llm", lambda: SimpleNamespace(speech=fake_speech))
    main._speech_cache.clear()
    body = {"text": "पैर हटाने के लिए चारों पेंच खोलें।", "lang": "hi"}
    first, second = client.post("/api/speak", json=body), client.post("/api/speak", json=body)
    assert first.status_code == second.status_code == 200
    assert first.headers["content-type"] == "audio/wav"
    assert first.content == second.content
    assert calls == [(body["text"], "hi")]  # the repeat came from the cache
    main._speech_cache.clear()


def test_gemini_speech_wraps_pcm_in_a_wav_header():
    import asyncio
    import io
    import wave
    from types import SimpleNamespace

    from app.config import get_settings
    from app.llm.gemini import GeminiLLM

    seen = {}

    async def generate_content(model, contents, config):
        seen.update(model=model, locale=config.speech_config.language_code)
        audio = SimpleNamespace(data=b"\x01\x00" * 1600, mime_type="audio/L16;codec=pcm;rate=16000")
        return SimpleNamespace(candidates=[SimpleNamespace(content=SimpleNamespace(parts=[SimpleNamespace(inline_data=audio)]))])

    llm = object.__new__(GeminiLLM)  # skip the Vertex AI client
    llm.s = get_settings()
    llm.client = SimpleNamespace(aio=SimpleNamespace(models=SimpleNamespace(generate_content=generate_content)))
    wav = asyncio.run(llm.speech("नमस्ते", "hi"))
    with wave.open(io.BytesIO(wav)) as w:
        assert (w.getframerate(), w.getnchannels(), w.getsampwidth(), w.getnframes()) == (16000, 1, 2, 1600)
    assert seen == {"model": llm.s.model_tts, "locale": "hi-IN"}


def test_pricing_retries_and_never_fails_the_scan():
    """Search-grounded replies are sometimes empty or prose only; that must not stop a scan."""
    import asyncio
    from types import SimpleNamespace

    from app.config import get_settings
    from app.llm.gemini import GeminiLLM

    def run(replies):
        calls = []

        async def generate_content(model, contents, config):
            calls.append(model)
            return SimpleNamespace(text=replies[len(calls) - 1], candidates=[SimpleNamespace(grounding_metadata=None)])

        llm = object.__new__(GeminiLLM)  # skip the Vertex AI client
        llm.s = get_settings()
        llm.client = SimpleNamespace(aio=SimpleNamespace(models=SimpleNamespace(generate_content=generate_content)))
        items = [{"type": "teak chair", "condition": "B"}, {"type": "steel almirah", "condition": "C"}]
        return asyncio.run(llm.price_items(items, "Bengaluru")), len(calls)

    good = '{"prices": [{"index": 0, "value_min_inr": 800, "value_max_inr": 1500, "sources": ["https://example.in/a"]}]}'
    prices, calls = run(["", good])
    assert calls == 2 and prices[0]["value_max_inr"] == 1500 and prices[1]["value_max_inr"] is None

    prices, calls = run(["Sorry, I couldn't find listings.", ""])
    assert calls == 2 and len(prices) == 2
    assert all(p["value_min_inr"] is None and p["sources"] == [] for p in prices)


def test_pricing_gives_up_on_a_stalled_search(monkeypatch):
    import asyncio
    from types import SimpleNamespace

    from app.config import get_settings
    from app.llm import gemini

    monkeypatch.setattr(gemini, "PRICING_TIMEOUT_S", 0.05)

    async def generate_content(model, contents, config):
        await asyncio.sleep(5)

    llm = object.__new__(gemini.GeminiLLM)
    llm.s = get_settings()
    llm.client = SimpleNamespace(aio=SimpleNamespace(models=SimpleNamespace(generate_content=generate_content)))
    prices = asyncio.run(llm.price_items([{"type": "teak chair"}], "Bengaluru"))
    assert prices == [{"value_min_inr": None, "value_max_inr": None, "repair_cost_inr": None, "sources": []}]



def test_spoken_summary_is_translated_before_speaking(client, monkeypatch):
    from types import SimpleNamespace
    from urllib.parse import unquote

    from app import main
    from app.llm.gemini import pcm_to_wav

    said = []

    async def translate(text, lang):
        return f"[{lang}] {text}"

    async def speech(text, lang):
        said.append((text, lang))
        return pcm_to_wav(b"\x00\x00" * 240)

    monkeypatch.setattr(main, "get_llm", lambda: SimpleNamespace(translate=translate, speech=speech))
    main._speech_cache.clear()
    r = client.post("/api/speak", json={"text": "Scout found 2 items.", "lang": "kn", "translate": True})
    assert r.status_code == 200
    assert unquote(r.headers["x-spoken-text"]) == "[kn] Scout found 2 items."
    assert said == [("[kn] Scout found 2 items.", "kn")]
    main._speech_cache.clear()


def test_offline_summary_keeps_the_english_for_the_device_voice(client):
    from urllib.parse import unquote

    r = client.post("/api/speak", json={"text": "Scout found 2 items.", "lang": "hi", "translate": True})
    assert r.status_code == 204
    assert unquote(r.headers["x-spoken-text"]) == "Scout found 2 items."


def test_judge_mode_never_sends_its_empty_sample_media_to_the_live_model():
    """In live mode the demo's videos and notice are empty placeholders; Gemini must not get them."""
    import asyncio

    from app.config import get_settings
    from app.llm.mock import MockLLM
    from app.models import Job

    calls = []

    class Live(MockLLM):
        async def scout_media(self, *a, **k):
            raise AssertionError("sample video sent to the live model")

        async def oracle_document(self, *a, **k):
            raise AssertionError("sample notice sent to the live model")

        async def price_items(self, *a, **k):
            raise AssertionError("sample prices asked of the live model")

        async def negotiation_message(self, *a, **k):
            calls.append("negotiation_message")
            return await super().negotiation_message(*a, **k)

        async def embed_texts(self, texts):
            calls.append("embed_texts")
            return await super().embed_texts(texts)

    settings = get_settings()
    store = get_store()
    job = Job(kind="judge_mode")
    store.upsert_job(job)
    result = asyncio.run(agents.judge_mode(store, Live(settings), settings, job.id))
    assert result["deal_id"] and "negotiation_message" in calls and "embed_texts" in calls
    # Sample data stays labelled as sample data, even when the model is live.
    live = settings.model_copy(update={"mock_mode": False})
    store.reset()
    job = Job(kind="judge_mode")
    store.upsert_job(job)
    asyncio.run(agents.judge_mode(store, Live(live), live, job.id))
    assert store.list_items() and all(i.synthetic for i in store.list_items())
    assert all(p.synthetic for p in store.list_predictions())
