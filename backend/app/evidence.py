"""Evidence photos for item passports, with faces blurred before anything is stored or shown.

For a video, Scout's timestamps say where each item appears; we grab those frames. For photos,
the photo the item was found in is used. Every image passes through face blurring first.
Original uploads are only read by Gemini; they are never shown in the app.
Runs fully offline (OpenCV); no API keys needed.
"""

from __future__ import annotations

import logging
import os
import tempfile
import uuid
from functools import lru_cache
from typing import Optional

import cv2
import numpy as np

from .config import Settings, get_settings
from .llm.base import MediaRef
from .models import Item

log = logging.getLogger(__name__)

_CASCADE = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
MAX_SIDE = 960
MAX_PER_ITEM = 3


def blur_faces(img: np.ndarray) -> tuple[np.ndarray, int]:
    """Heavily blur every detected face. Returns the new image and the number of faces."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    min_side = max(24, min(img.shape[:2]) // 20)
    faces = _CASCADE.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(min_side, min_side))
    out = img.copy()
    for (x, y, w, h) in faces:
        pad = int(0.25 * max(w, h))
        x0, y0 = max(0, x - pad), max(0, y - pad)
        x1, y1 = min(img.shape[1], x + w + pad), min(img.shape[0], y + h + pad)
        roi = out[y0:y1, x0:x1]
        k = max(31, (max(w, h) // 2) * 2 + 1)
        out[y0:y1, x0:x1] = cv2.GaussianBlur(roi, (k, k), 0)
    return out, len(faces)


def _shrink(img: np.ndarray) -> np.ndarray:
    h, w = img.shape[:2]
    scale = MAX_SIDE / max(h, w)
    return cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA) if scale < 1 else img


def _decode_image(data: bytes) -> Optional[np.ndarray]:
    arr = np.frombuffer(data, dtype=np.uint8)
    return cv2.imdecode(arr, cv2.IMREAD_COLOR)


def frames_at(video: bytes, seconds: list[float]) -> list[np.ndarray]:
    """Read frames from a video at the given times (needs a seekable file, so use a temp file)."""
    frames: list[np.ndarray] = []
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as f:
        f.write(video)
        path = f.name
    try:
        cap = cv2.VideoCapture(path)
        if not cap.isOpened():
            return frames
        for s in seconds:
            cap.set(cv2.CAP_PROP_POS_MSEC, max(0.0, s) * 1000)
            ok, frame = cap.read()
            if ok and frame is not None:
                frames.append(frame)
        cap.release()
    finally:
        os.unlink(path)
    return frames


def to_jpeg(img: np.ndarray) -> bytes:
    ok, buf = cv2.imencode(".jpg", _shrink(img), [cv2.IMWRITE_JPEG_QUALITY, 82])
    return buf.tobytes() if ok else b""


class EvidenceStore:
    """Memory in mock/local mode; Cloud Storage (private, served through the API) in live mode."""

    def __init__(self, settings: Settings):
        self.s = settings
        self._mem: dict[str, bytes] = {}

    def _bucket(self):
        from google.cloud import storage

        return storage.Client(project=self.s.gcp_project or None).bucket(self.s.gcs_bucket)

    def put(self, jpeg: bytes) -> str:
        eid = f"ev_{uuid.uuid4().hex[:12]}"
        if self.s.mock_mode or not self.s.gcs_bucket:
            self._mem[eid] = jpeg
        else:
            self._bucket().blob(f"evidence/{eid}.jpg").upload_from_string(jpeg, content_type="image/jpeg")
        return eid

    def get(self, eid: str) -> Optional[bytes]:
        if not eid.startswith("ev_") or "/" in eid:
            return None
        if eid in self._mem:
            return self._mem[eid]
        if self.s.mock_mode or not self.s.gcs_bucket:
            return None
        blob = self._bucket().blob(f"evidence/{eid}.jpg")
        return blob.download_as_bytes() if blob.exists() else None


def attach_evidence(items: list[Item], media: list[MediaRef], store: EvidenceStore) -> int:
    """Fill item.evidence with blurred frames or photos. Returns how many faces were blurred."""
    blurred = 0
    for it in items:
        idx = it.media_index if it.media_index is not None and it.media_index < len(media) else 0
        if not media:
            continue
        m = media[idx]
        if not m.data:
            continue
        try:
            if m.mime_type.startswith("video/"):
                images = frames_at(m.data, it.timestamps_s[:MAX_PER_ITEM] or [1.0])
            elif m.mime_type.startswith("image/"):
                img = _decode_image(m.data)
                images = [img] if img is not None else []
            else:
                images = []
        except Exception as exc:  # evidence is best effort; never break a scan
            log.warning("Evidence extraction failed for %s: %s", m.name, exc)
            images = []
        for img in images[:MAX_PER_ITEM]:
            safe, n = blur_faces(img)
            blurred += n
            jpeg = to_jpeg(safe)
            if jpeg:
                it.evidence.append(store.put(jpeg))
    return blurred


@lru_cache
def get_evidence_store() -> EvidenceStore:
    return EvidenceStore(get_settings())
