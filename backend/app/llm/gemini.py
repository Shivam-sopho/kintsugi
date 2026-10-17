"""Live backend: Gemini on Vertex AI through the google-genai SDK.

Not yet exercised against the live API (written without credentials). On Day 1, run
`python -m scripts.smoke_live` from backend/ to check each call and adjust if needed.
"""

from __future__ import annotations

import asyncio
import io
import json
import logging
import re
import wave
from typing import Any, Optional

from google import genai
from google.genai import errors as genai_errors
from google.genai import types

from ..config import Settings
from . import prompts
from .base import MediaRef
from .schemas import DESIGN_SCHEMA, MESSAGES_SCHEMA, ORACLE_SCHEMA, SCOUT_SCHEMA, TAKE_APART_SCHEMA, TRANSCRIBE_SCHEMA, TRANSLATE_SCHEMA, ASK_SCHEMA, EXPLAIN_SCHEMA

log = logging.getLogger(__name__)


def _part(m: MediaRef) -> types.Part:
    if m.uri:
        return types.Part.from_uri(file_uri=m.uri, mime_type=m.mime_type)
    if m.data is not None:
        return types.Part.from_bytes(data=m.data, mime_type=m.mime_type)
    raise ValueError(f"Media {m.name} has neither uri nor data")


def _json_from_text(text: str) -> Any:
    """Parse JSON from a model reply that may wrap it in prose or code fences."""
    text = (text or "").strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        raise ValueError("No JSON object in model reply")
    return json.loads(match.group(0))


class GeminiLLM:
    def __init__(self, settings: Settings):
        self.s = settings
        self.client = genai.Client(vertexai=True, project=settings.gcp_project, location=settings.genai_location)
        # Gemini Embedding 2 is served only from regions, not the global endpoint.
        self.embed_client = genai.Client(vertexai=True, project=settings.gcp_project, location=settings.gcp_location)

    async def _json(self, model: str, contents: list, system: str, schema: dict, temperature: float = 0.2) -> Any:
        config = types.GenerateContentConfig(
            system_instruction=system,
            response_mime_type="application/json",
            response_json_schema=schema,
            temperature=temperature,
        )
        try:
            resp = await self.client.aio.models.generate_content(model=model, contents=contents, config=config)
        except genai_errors.APIError as exc:
            # The client already retried with backoff. If Gemini's shared capacity for this model is
            # still busy (429), a person's scan should not fail: Flash does the same job a little less well.
            if exc.code != 429 or model == self.s.model_fast:
                raise
            log.warning("%s is busy (429); using %s for this call", model, self.s.model_fast)
            resp = await self.client.aio.models.generate_content(model=self.s.model_fast, contents=contents, config=config)
        return _json_from_text(resp.text)

    async def scout_media(self, media: list[MediaRef], kind: str, narration_text: str | None) -> dict[str, Any]:
        contents = [_part(m) for m in media] + [prompts.scout_user_prompt(kind, narration_text)]
        return await self._json(self.s.model_reasoning, contents, prompts.SCOUT_SYSTEM, SCOUT_SCHEMA)

    async def oracle_document(self, doc: MediaRef) -> dict[str, Any]:
        contents = [_part(doc), "Extract the predictions as JSON."]
        return await self._json(self.s.model_reasoning, contents, prompts.ORACLE_SYSTEM, ORACLE_SCHEMA)

    async def price_items(self, items: list[dict[str, Any]], city: str) -> list[dict[str, Any]]:
        lines = "\n".join(
            f"{i}. {it['type']} (condition {it.get('condition', 'C')}, {it.get('description', '')})"
            for i, it in enumerate(items)
        )
        # Search grounding is used without a response schema; the JSON is parsed from text. Grounded
        # replies are sometimes empty or prose only, so try twice, then leave the items unpriced
        # rather than fail the whole scan.
        parsed: list[dict[str, Any]] = []
        grounded_urls: list[str] = []
        for attempt in (1, 2):
            try:
                resp = await asyncio.wait_for(
                    self.client.aio.models.generate_content(
                        model=self.s.model_fast,
                        contents=[f"City: {city}. Items:\n{lines}"],
                        config=types.GenerateContentConfig(
                            system_instruction=prompts.PRICING_SYSTEM,
                            tools=[types.Tool(google_search=types.GoogleSearch())],
                            temperature=0.1,
                            thinking_config=types.ThinkingConfig(thinking_budget=PRICING_THINKING_BUDGET),
                        ),
                    ),
                    timeout=PRICING_TIMEOUT_S,
                )
            except asyncio.TimeoutError:
                log.warning("Pricing attempt %d took over %ds", attempt, PRICING_TIMEOUT_S)
                continue
            try:
                parsed = _json_from_text(resp.text).get("prices", [])
            except (ValueError, AttributeError) as exc:
                log.warning("Pricing reply %d had no JSON (%s): %r", attempt, exc, (resp.text or "")[:300])
                continue
            try:
                meta = resp.candidates[0].grounding_metadata
                for chunk in (meta.grounding_chunks or []) if meta else []:
                    if chunk.web and chunk.web.uri:
                        grounded_urls.append(chunk.web.uri)
            except (AttributeError, IndexError):
                pass
            break
        by_index = {p.get("index"): p for p in parsed}
        out = []
        for i in range(len(items)):
            p = by_index.get(i, {})
            out.append(
                {
                    "value_min_inr": p.get("value_min_inr"),
                    "value_max_inr": p.get("value_max_inr"),
                    "repair_cost_inr": p.get("repair_cost_inr"),
                    "sources": (p.get("sources") or [])[:3] or grounded_urls[:3],
                }
            )
        return out

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        # Gemini Embedding 2 is multimodal: a list of contents is embedded as ONE input, so each
        # text gets its own call (a few at a time) to get one vector per text.
        limit = asyncio.Semaphore(EMBED_CONCURRENCY)

        async def one(text: str) -> list[float]:
            async with limit:
                resp = await self.embed_client.aio.models.embed_content(
                    model=self.s.model_embedding,
                    contents=text,
                    config=types.EmbedContentConfig(output_dimensionality=self.s.embedding_dim),
                )
                return list(resp.embeddings[0].values)

        vectors = await asyncio.gather(*(one(t) for t in texts))
        if len(vectors) != len(texts):
            raise ValueError("Embedding count does not match the texts")
        return list(vectors)

    async def embed_image(self, data: bytes, mime_type: str) -> list[float]:
        resp = await self.embed_client.aio.models.embed_content(
            model=self.s.model_embedding,
            contents=[types.Part.from_bytes(data=data, mime_type=mime_type)],
            config=types.EmbedContentConfig(output_dimensionality=self.s.embedding_dim),
        )
        return list(resp.embeddings[0].values)

    async def negotiation_message(
        self, role: str, action: str, price: float, item_summary: str, local_lang: str
    ) -> dict[str, str]:
        data = await self._json(
            self.s.model_fast,
            [prompts.negotiation_voice_prompt(role, action, price, item_summary, local_lang)],
            prompts.NEGOTIATION_VOICE_SYSTEM,
            MESSAGES_SCHEMA,
            temperature=0.6,
        )
        return {"en": data["en"], "local": data["local"]}

    async def design(
        self, brief: str, budget_inr: float, candidates: list[dict[str, Any]], image: Optional[MediaRef] = None
    ) -> dict[str, Any]:
        payload = json.dumps({"brief": brief, "budget_inr": budget_inr, "candidates": candidates}, ensure_ascii=False)
        contents: list = [payload]
        if image is not None:
            contents = [_part(image), "This is the buyer's sketch or inspiration photo. Match its style.", payload]
        return await self._json(self.s.model_reasoning, contents, prompts.ARCHITECT_SYSTEM, DESIGN_SCHEMA, 0.5)

    async def transcribe(self, audio: MediaRef, hint: str = "") -> dict[str, str]:
        data = await self._json(self.s.model_fast, [_part(audio), "Transcribe this recording."],
                                prompts.TRANSCRIBE_SYSTEM, TRANSCRIBE_SCHEMA, 0.0)
        out = {"text": data["text"], "language": data.get("language", ""), "english": data.get("english", "")}
        if data.get("amount_inr") is not None:
            out["amount_inr"] = data["amount_inr"]
        return out

    async def take_apart(self, item_type: str, components: list[str], local_lang: str) -> dict[str, list[str]]:
        data = await self._json(self.s.model_fast, [prompts.take_apart_prompt(item_type, components, local_lang)],
                                prompts.TAKE_APART_SYSTEM, TAKE_APART_SCHEMA, 0.3)
        return {"en": data["en"], "local": data["local"]}

    async def render(self, prompt: str) -> Optional[bytes]:
        try:
            resp = await self.client.aio.models.generate_content(
                model=self.s.model_image,
                contents=[prompt],
                config=types.GenerateContentConfig(response_modalities=["TEXT", "IMAGE"]),
            )
            for part in resp.candidates[0].content.parts:
                if part.inline_data and part.inline_data.data:
                    return part.inline_data.data
        except Exception as exc:  # rendering is optional; never break the flow
            log.warning("Render failed: %s", exc)
        return None

    async def explain(self, item: dict[str, Any], lang: str) -> dict[str, Any]:
        prompt = (f"ITEM (JSON):\n{json.dumps(item, ensure_ascii=False)}\n\n"
                  f"Write everything in {LANGUAGE_NAMES.get(lang, lang)} ({lang}).")
        return await self._json(self.s.model_fast, [prompt], prompts.EXPLAIN_SYSTEM, EXPLAIN_SCHEMA, 0.3)

    async def ask(self, question: str, history: list[dict[str, str]], context: dict[str, Any], lang: str) -> dict[str, Any]:
        turns = "\n".join(f"{t.get('role', 'user')}: {t.get('text', '')}" for t in history[-6:])
        name = LANGUAGE_NAMES.get(lang, lang)
        prompt = (f"CONTEXT (JSON):\n{json.dumps(context, ensure_ascii=False)}\n\nEarlier in this conversation:\n"
                  f"{turns or '(nothing yet)'}\n\n"
                  f"Person says: {question.strip() or '(nothing yet: greet them and make one useful suggestion)'}\n\n"
                  f"Write \"answer\" in {name} ({lang}), whatever language the context or profile uses.")
        return await self._json(self.s.model_fast, [prompt], prompts.ASK_SYSTEM, ASK_SCHEMA, 0.4)

    async def translate(self, text: str, lang: str) -> str:
        if lang == "en":
            return text
        data = await self._json(self.s.model_fast, [prompts.translate_prompt(text, lang)], prompts.TRANSLATE_SYSTEM,
                                TRANSLATE_SCHEMA)
        return data.get("text") or text

    async def speech(self, text: str, lang: str) -> Optional[bytes]:
        try:
            resp = await self.client.aio.models.generate_content(
                model=self.s.model_tts,
                contents=text,
                config=types.GenerateContentConfig(
                    response_modalities=["AUDIO"],
                    speech_config=types.SpeechConfig(
                        language_code=SPEECH_LOCALES.get(lang, lang),
                        voice_config=types.VoiceConfig(
                            prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=self.s.tts_voice)
                        ),
                    ),
                ),
            )
            for part in resp.candidates[0].content.parts:
                if part.inline_data and part.inline_data.data:
                    return pcm_to_wav(part.inline_data.data, _sample_rate(part.inline_data.mime_type))
        except Exception as exc:  # speech is optional; the app falls back to the device's voice
            log.warning("Speech failed: %s", exc)
        return None


EMBED_CONCURRENCY = 6
PRICING_TIMEOUT_S = 45  # per attempt; a scan should never wait minutes on a price search
PRICING_THINKING_BUDGET = 512

LANGUAGE_NAMES = {"en": "English", "hi": "Hindi", "kn": "Kannada", "ta": "Tamil", "id": "Bahasa Indonesia",
                  "ms": "Bahasa Melayu", "th": "Thai", "vi": "Vietnamese", "fil": "Filipino", "ja": "Japanese"}

SPEECH_LOCALES = {"en": "en-IN", "hi": "hi-IN", "kn": "kn-IN", "ta": "ta-IN", "id": "id-ID", "ms": "ms-MY",
                  "th": "th-TH", "vi": "vi-VN", "fil": "fil-PH", "ja": "ja-JP"}


def _sample_rate(mime_type: str | None, default: int = 24000) -> int:
    """Gemini TTS returns raw 16-bit PCM, e.g. "audio/L16;codec=pcm;rate=24000"."""
    match = re.search(r"rate=(\d+)", mime_type or "")
    return int(match.group(1)) if match else default


def pcm_to_wav(pcm: bytes, sample_rate: int = 24000) -> bytes:
    """Wrap mono 16-bit PCM in a WAV header so any browser can play it."""
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        w.writeframes(pcm)
    return buf.getvalue()
