"""Store uploads: Cloud Storage in live mode (Gemini reads gs:// URIs), memory in mock mode."""

from __future__ import annotations

import mimetypes
import uuid

from .config import Settings
from .llm.base import MediaRef

INLINE_LIMIT_BYTES = 15 * 1024 * 1024


def guess_mime(filename: str, fallback: str = "application/octet-stream") -> str:
    return mimetypes.guess_type(filename)[0] or fallback


def to_media_ref(filename: str, data: bytes, content_type: str | None, settings: Settings) -> MediaRef:
    mime = content_type or guess_mime(filename)
    if settings.mock_mode or not settings.gcs_bucket:
        if not settings.mock_mode and len(data) > INLINE_LIMIT_BYTES:
            raise ValueError("Set GCS_BUCKET to upload media larger than 15 MB")
        return MediaRef(name=filename, mime_type=mime, data=data)

    from google.cloud import storage

    blob_name = f"uploads/{uuid.uuid4().hex}/{filename}"
    bucket = storage.Client(project=settings.gcp_project or None).bucket(settings.gcs_bucket)
    bucket.blob(blob_name).upload_from_string(data, content_type=mime)
    # Keep the bytes too: evidence frames are cut locally, Gemini reads the gs:// copy.
    return MediaRef(name=filename, mime_type=mime, uri=f"gs://{settings.gcs_bucket}/{blob_name}", data=data)
