"""A design's rendered picture is stored on its own and referenced by id, so the job's result stays
small enough for Firestore (a render inside it made the demo's last step never finish)."""

import json

import cv2
import numpy as np

from app.llm.mock import MockLLM

from .test_features import client, scan, wait  # noqa: F401  (pytest fixture and helpers)


def test_the_render_is_stored_by_id_not_inside_the_result(client, monkeypatch):
    ok, png = cv2.imencode(".png", np.full((400, 600, 3), 180, np.uint8))
    assert ok

    async def render(self, prompt):
        return png.tobytes()

    monkeypatch.setattr(MockLLM, "render", render)
    scan(client)  # something to design with
    body = {"brief": "a cozy cafe", "budget_inr": 60000, "lat": 12.9352, "lng": 77.6245}
    job = wait(client, client.post("/api/design", json=body).json()["id"])
    design = job["result"]["design"] if "design" in job["result"] else job["result"]
    assert design["render_id"] and "render_png_b64" not in design
    assert len(json.dumps(job["result"])) < 50_000
    pic = client.get(f"/api/evidence/{design['render_id']}")
    assert pic.status_code == 200 and pic.content[:2] == b"\xff\xd8"  # a JPEG
