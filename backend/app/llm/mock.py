"""Offline backend: deterministic fixtures so the app runs with no credentials."""

from __future__ import annotations

import asyncio
import copy
from typing import Any, Optional

from ..config import Settings
from ..demo import fixtures
from . import mock_embed
from .base import MediaRef


class MockLLM:
    def __init__(self, settings: Settings):
        self.s = settings

    async def _pause(self) -> None:
        await asyncio.sleep(0.05)

    async def scout_media(self, media: list[MediaRef], kind: str, narration_text: str | None) -> dict[str, Any]:
        await self._pause()
        names = " ".join(m.name.lower() for m in media) + " " + (narration_text or "").lower()
        if kind == "home" or any(k in names for k in ("chair", "kursi", "कुर्सी")):
            return copy.deepcopy(fixtures.SCOUT_CHAIR)
        return copy.deepcopy(fixtures.SCOUT_OFFICE)

    async def oracle_document(self, doc: MediaRef) -> dict[str, Any]:
        await self._pause()
        return {
            "predictions": [
                p.model_dump(exclude={"id", "location", "synthetic"}) for p in fixtures.predictions()
            ]
        }

    async def price_items(self, items: list[dict[str, Any]], city: str) -> list[dict[str, Any]]:
        await self._pause()
        out = []
        for it in items:
            t = it["type"].lower()
            match = next((p for p in fixtures.SAMPLE_PRICES if p[0] in t), None)
            if match:
                _, lo, hi, repair = match
                out.append({"value_min_inr": lo, "value_max_inr": hi, "repair_cost_inr": repair, "sources": ["sample data"]})
            else:
                out.append({"value_min_inr": None, "value_max_inr": None, "repair_cost_inr": None, "sources": []})
        return out

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        return [mock_embed.embed(t, self.s.embedding_dim) for t in texts]

    async def embed_image(self, data: bytes, mime_type: str) -> list[float]:
        # No image understanding offline: treat the photo as a generic wood/door query.
        return mock_embed.embed("wooden door", self.s.embedding_dim)

    async def negotiation_message(
        self, role: str, action: str, price: float, item_summary: str, local_lang: str
    ) -> dict[str, str]:
        en, hi = fixtures.NEGOTIATION_TEMPLATES[(role, action)]
        p = f"{price:,.0f}"
        english = en.format(item=item_summary, price=p)
        # Offline templates exist only for Hindi; other languages fall back to English.
        local = hi.format(item=item_summary, price=p) if local_lang == "hi" else english
        return {"en": english, "local": local}

    async def design(self, brief: str, budget_inr: float, candidates: list[dict[str, Any]]) -> dict[str, Any]:
        await self._pause()
        selected, spent = [], 0.0
        for c in candidates:
            unit = c.get("unit_price_inr") or 0
            qty = min(c.get("count", 1), 4 if "door" in c["type"] else 6)
            if unit and spent + unit * qty > budget_inr:
                qty = int((budget_inr - spent) // unit) if unit else qty
            if qty <= 0:
                continue
            spent += unit * qty
            use = {
                "door": "entrance and partition doors, kept in natural teak",
                "pendant light": "cluster of pendants over the counter",
                "tile": "counter front and floor border",
                "wash basin": "washroom basins",
                "window": "glazed partition between kitchen and seating",
            }
            how = next((v for k, v in use.items() if k in c["type"]), "feature piece")
            selected.append({"item_id": c["id"], "use": how, "quantity": qty})
        return {
            "concept": "A warm, rustic café built around reclaimed teak and industrial lighting. "
            "Every major piece comes from buildings within 15 km.",
            "selected": selected,
            "render_prompt": f"Photorealistic interior of a small café: {brief}. Reclaimed teak doors, "
            "black metal pendant lights, beige tiles, warm daylight.",
        }

    async def render(self, prompt: str) -> Optional[bytes]:
        return None
