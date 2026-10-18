"""When Gemini's shared capacity is busy (429), a scan falls back from Pro to Flash instead of failing,
and people see plain words, not the raw API error."""

import asyncio
from types import SimpleNamespace

import pytest
from google.genai import errors

from app.config import get_settings
from app import main
from app.llm import gemini
from app.llm.gemini import GeminiLLM
from app.main import friendly_error

from .test_features import client, scan  # noqa: F401  (pytest fixture and helpers)

BUSY = errors.ClientError(429, {"error": {"code": 429, "message": "Resource exhausted.", "status": "RESOURCE_EXHAUSTED"}})


def _llm(busy_models: set[str]):
    calls = []

    async def generate_content(model, contents, config):
        calls.append(model)
        if model in busy_models:
            raise BUSY
        return SimpleNamespace(text='{"ok": true}')

    llm = GeminiLLM.__new__(GeminiLLM)
    llm.s = get_settings()
    llm.client = SimpleNamespace(aio=SimpleNamespace(models=SimpleNamespace(generate_content=generate_content)))
    return llm, calls


def test_busy_pro_falls_back_to_flash():
    s = get_settings()
    llm, calls = _llm({s.model_reasoning})
    assert asyncio.run(llm._json(s.model_reasoning, ["x"], "sys", {})) == {"ok": True}
    assert calls == [s.model_reasoning, s.model_fast]


def test_busy_flash_waits_then_is_reported_in_plain_words(monkeypatch):
    monkeypatch.setattr(gemini, "BUSY_WAITS_S", (0, 0))
    s = get_settings()
    llm, calls = _llm({s.model_fast})
    with pytest.raises(errors.APIError) as exc:
        asyncio.run(llm._json(s.model_fast, ["x"], "sys", {}))
    assert calls == [s.model_fast] * 3  # first try, then two waits
    assert "nothing you added was lost" in friendly_error(exc.value)
    assert friendly_error(ValueError("No taker nearby")) == "No taker nearby"


def test_a_busy_request_answers_503_in_plain_words(client, monkeypatch):
    async def busy(*args, **kwargs):
        raise BUSY

    item = scan(client, kind="home", seller_id="ppl_me")[0]
    monkeypatch.setattr(main, "get_llm", lambda: SimpleNamespace(explain=busy))
    r = client.get(f"/api/items/{item['id']}/explain?lang=th")
    assert r.status_code == 503 and r.json()["busy"] and "RESOURCE_EXHAUSTED" not in r.text
    assert r.headers["retry-after"] == "5"
