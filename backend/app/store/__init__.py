from functools import lru_cache

from ..config import get_settings
from .base import Store


@lru_cache
def get_store() -> Store:
    settings = get_settings()
    if settings.store == "firestore":
        from .firestore_store import FirestoreStore

        return FirestoreStore(settings)
    from .memory import MemoryStore

    return MemoryStore()


__all__ = ["Store", "get_store"]
