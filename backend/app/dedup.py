"""Merge repeated sightings of the same object (e.g. from several clips of one site)."""

from __future__ import annotations

from .models import Item
from .vectors import cosine


def dedup_items(items: list[Item], threshold: float = 0.92) -> list[Item]:
    """Within one site, merge items of the same type whose embeddings are near-identical.

    A repeated sighting is the same object, so counts are not added: the merged item keeps
    the larger count, the higher confidence and every timestamp.
    """
    kept: list[Item] = []
    for it in items:
        twin = next(
            (
                k for k in kept
                if k.site_id == it.site_id
                and k.type.strip().lower() == it.type.strip().lower()
                and k.embedding and it.embedding
                and cosine(k.embedding, it.embedding) >= threshold
            ),
            None,
        )
        if twin is None:
            kept.append(it.model_copy(deep=True))
            continue
        twin.count = max(twin.count, it.count)
        twin.timestamps_s = sorted(set(twin.timestamps_s) | set(it.timestamps_s))
        if it.confidence > twin.confidence:
            twin.confidence = it.confidence
            twin.description = it.description or twin.description
    return kept
