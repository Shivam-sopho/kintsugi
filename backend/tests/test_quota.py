"""When Gemini's shared capacity is busy (429), a scan falls back from Pro to Flash instead of failing,
and people see plain words, not the raw API error."""

import asyncio
from types import SimpleNamespace

import pytest
from google.genai import errors

from app.config import get_settings
from app.llm.gemini import GeminiLLM
from app.main import friendly_error

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


def test_busy_flash_is_reported_in_plain_words():
    s = get_settings()
    llm, _ = _llm({s.model_fast})
    with pytest.raises(errors.APIError) as exc:
        asyncio.run(llm._json(s.model_fast, ["x"], "sys", {}))
    assert "try again in a minute" in friendly_error(exc.value)
    assert friendly_error(ValueError("No taker nearby")) == "No taker nearby"
