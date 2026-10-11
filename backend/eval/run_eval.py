"""Measure Scout on your own labelled clips.

    cd backend
    MOCK_MODE=false python -m eval.run_eval eval/labels.json      # live Gemini
    python -m eval.run_eval eval/labels.example.json --dry-run    # checks the harness offline

Writes eval/results.md with item precision and recall, count error and material accuracy.
Report whatever the numbers are; they are more convincing than any claim.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import time
from pathlib import Path

from app.config import get_settings
from app.llm import get_llm
from app.llm.base import MediaRef
from app.llm.mock_embed import embed
from app.materials import canonical_material
from app.media import guess_mime
from app.vectors import cosine


def same_item(a: str, b: str) -> bool:
    a, b = a.lower(), b.lower()
    return a in b or b in a or cosine(embed(a, 256), embed(b, 256)) >= 0.5


def score_clip(expected: list[dict], predicted: list[dict]) -> dict:
    used, matches = set(), []
    for e in expected:
        for i, p in enumerate(predicted):
            if i not in used and same_item(e["type"], p["type"]):
                used.add(i)
                matches.append((e, p))
                break
    tp = len(matches)
    count_err = [abs(e["count"] - p.get("count", 1)) / max(e["count"], 1) for e, p in matches]
    mat_hits = mat_total = 0
    for e, p in matches:
        want = {canonical_material(m) for m in e.get("materials", [])}
        got = {canonical_material(c["material"]) for c in p.get("components", [])}
        mat_total += len(want)
        mat_hits += len(want & got)
    return {
        "tp": tp, "expected": len(expected), "predicted": len(predicted),
        "count_err_sum": sum(count_err), "mat_hits": mat_hits, "mat_total": mat_total,
    }


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("labels")
    ap.add_argument("--dry-run", action="store_true", help="don't read clips; use the offline model")
    args = ap.parse_args()
    s = get_settings()
    labels = json.loads(Path(args.labels).read_text(encoding="utf-8"))
    llm = get_llm()
    rows, agg = [], {"tp": 0, "expected": 0, "predicted": 0, "count_err_sum": 0.0, "mat_hits": 0, "mat_total": 0}
    for clip in labels["clips"]:
        path = Path(clip["path"])
        data = b"" if args.dry_run else path.read_bytes()
        t0 = time.time()
        raw = await llm.scout_media([MediaRef(name=path.name, mime_type=guess_mime(path.name, "video/mp4"), data=data)],
                                    clip.get("kind", "home"), clip.get("notes"))
        sc = score_clip(clip["expected"], raw.get("items", []))
        sc["latency_s"] = round(time.time() - t0, 1)
        rows.append((path.name, sc))
        for k in agg:
            agg[k] += sc[k]
    precision = agg["tp"] / agg["predicted"] if agg["predicted"] else 0
    recall = agg["tp"] / agg["expected"] if agg["expected"] else 0
    count_err = agg["count_err_sum"] / agg["tp"] if agg["tp"] else 0
    mat_acc = agg["mat_hits"] / agg["mat_total"] if agg["mat_total"] else 0
    lines = [
        f"# Scout evaluation ({'offline dry run' if s.mock_mode else s.model_reasoning})", "",
        f"Clips: {len(rows)}. Item precision {precision:.0%}, recall {recall:.0%}, "
        f"mean count error {count_err:.0%}, material accuracy {mat_acc:.0%}.", "",
        "| Clip | Expected | Predicted | Matched | Latency (s) |", "|---|---|---|---|---|",
    ] + [f"| {n} | {r['expected']} | {r['predicted']} | {r['tp']} | {r['latency_s']} |" for n, r in rows]
    out = Path("eval/results.md")
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))


if __name__ == "__main__":
    asyncio.run(main())
