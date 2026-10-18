"""Gemini's voice, kept: each spoken line (in its language, translated or not) is generated once and
stored, in memory and, live, in Cloud Storage, so the demo's narration and repeated lines play at
once for everyone, even after a restart. Nothing personal is spoken by the app's fixed lines; lines
built from a person's own items are stored the same way, privately in the project's bucket."""

from __future__ import annotations

import hashlib
import logging
from collections import OrderedDict
from typing import Optional

from .config import Settings

log = logging.getLogger(__name__)

MEMORY_SIZE = 300
_memory: OrderedDict[str, tuple[str, bytes]] = OrderedDict()


def key(lang: str, text: str, translate: bool) -> str:
    return hashlib.sha256(f"{lang}|{int(translate)}|{text}".encode()).hexdigest()[:40]


def _blob(settings: Settings, k: str):
    from google.cloud import storage

    return storage.Client(project=settings.gcp_project or None).bucket(settings.gcs_bucket).blob(f"speech/{k}.wav")


def get(settings: Settings, k: str) -> Optional[tuple[str, bytes]]:
    hit = _memory.get(k)
    if hit:
        _memory.move_to_end(k)
        return hit
    if settings.mock_mode or not settings.gcs_bucket:
        return None
    try:
        blob = _blob(settings, k)
        if not blob.exists():
            return None
        audio = blob.download_as_bytes()
        blob.reload()
        spoken = (blob.metadata or {}).get("spoken", "")
        _remember(k, spoken, audio)
        return spoken, audio
    except Exception:  # a cache miss, never an error
        log.exception("Speech cache read failed")
        return None


def put(settings: Settings, k: str, spoken: str, audio: bytes) -> None:
    _remember(k, spoken, audio)
    if settings.mock_mode or not settings.gcs_bucket:
        return
    try:
        blob = _blob(settings, k)
        blob.metadata = {"spoken": spoken}
        blob.upload_from_string(audio, content_type="audio/wav")
    except Exception:
        log.exception("Speech cache write failed")


def _remember(k: str, spoken: str, audio: bytes) -> None:
    _memory[k] = (spoken, audio)
    if len(_memory) > MEMORY_SIZE:
        _memory.popitem(last=False)
