"""Check every live Gemini call once. Run from backend/ with live settings in .env:

    MOCK_MODE=false python -m scripts.smoke_live [path/to/short_video.mp4] [path/to/notice.pdf]

Each step prints OK or the error, so you can fix calls one at a time on Day 1.
"""

import asyncio
import sys
import traceback

from app.config import get_settings
from app.llm.base import MediaRef
from app.media import guess_mime


async def main() -> None:
    s = get_settings()
    if s.mock_mode:
        sys.exit("Set MOCK_MODE=false (and GCP_PROJECT) first.")
    from app.llm.gemini import GeminiLLM

    llm = GeminiLLM(s)

    async def step(name, coro):
        try:
            out = await coro
            print(f"OK   {name}: {str(out)[:300]}")
        except Exception:
            print(f"FAIL {name}")
            traceback.print_exc()

    await step("embed_texts", llm.embed_texts(["teak door", "सागौन का दरवाज़ा"]))
    await step("price_items", llm.price_items([{"type": "teak panel door", "condition": "B"}], "Bengaluru"))
    await step("negotiation_message", llm.negotiation_message("seller", "offer", 30000, "6 teak doors", "hi"))
    await step("design", llm.design("cozy café", 30000, [{"id": "itm_1", "type": "teak door", "count": 6, "unit_price_inr": 5000}]))
    await step("render", llm.render("A small café with reclaimed teak doors, photorealistic"))
    if len(sys.argv) > 1:
        path = sys.argv[1]
        data = open(path, "rb").read()
        await step("scout_media", llm.scout_media([MediaRef(name=path, mime_type=guess_mime(path, "video/mp4"), data=data)], "home", None))
    if len(sys.argv) > 2:
        path = sys.argv[2]
        await step("oracle_document", llm.oracle_document(MediaRef(name=path, mime_type="application/pdf", data=open(path, "rb").read())))


if __name__ == "__main__":
    asyncio.run(main())
