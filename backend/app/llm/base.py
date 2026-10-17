"""The interface every model backend implements (live Gemini or offline mock)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional, Protocol


@dataclass
class MediaRef:
    name: str
    mime_type: str
    uri: Optional[str] = None  # gs://bucket/path in live mode
    data: Optional[bytes] = None  # inline bytes (small files, or mock mode)


class LLM(Protocol):
    async def scout_media(self, media: list[MediaRef], kind: str, narration_text: str | None) -> dict[str, Any]:
        """Return {"items": [...], "narration_language": str, "narration_summary_en": str}."""

    async def oracle_document(self, doc: MediaRef) -> dict[str, Any]:
        """Return {"predictions": [...]}."""

    async def price_items(self, items: list[dict[str, Any]], city: str) -> list[dict[str, Any]]:
        """Return one dict per input item: value_min_inr, value_max_inr, repair_cost_inr, sources."""

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        ...

    async def embed_image(self, data: bytes, mime_type: str) -> list[float]:
        ...

    async def negotiation_message(
        self, role: str, action: str, price: float, item_summary: str, local_lang: str
    ) -> dict[str, str]:
        """Return {"en": ..., "local": ...}."""

    async def design(
        self, brief: str, budget_inr: float, candidates: list[dict[str, Any]], image: Optional[MediaRef] = None
    ) -> dict[str, Any]:
        """Return {"concept", "selected": [{"item_id","use","quantity"}], "render_prompt"}.
        `image` is an optional sketch or inspiration photo."""

    async def transcribe(self, audio: MediaRef, hint: str = "") -> dict[str, str]:
        """Return {"text", "language", "english"} for a voice recording in any language."""

    async def take_apart(self, item_type: str, components: list[str], local_lang: str) -> dict[str, list[str]]:
        """Return {"en": [...steps], "local": [...steps]}."""

    async def render(self, prompt: str) -> Optional[bytes]:
        """Return PNG/JPEG bytes, or None if rendering is unavailable."""

    async def ask(self, question: str, history: list[dict[str, str]], context: dict[str, Any], lang: str) -> dict[str, Any]:
        """Ask Kintsugi: answer from the person's context in their language, with one suggested
        action. Return {"answer", "answer_en", "language", "action": {"type", ...}}. An empty
        question asks for a proactive greeting and suggestion."""

    async def translate(self, text: str, lang: str) -> str:
        """Return the English `text` in language `lang`, for reading aloud (unchanged for English)."""

    async def speech(self, text: str, lang: str) -> Optional[bytes]:
        """Return WAV audio of `text` read aloud in `lang`, or None so the device's own voice reads it."""
