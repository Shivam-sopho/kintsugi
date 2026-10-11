from functools import lru_cache

from ..config import get_settings
from .base import LLM, MediaRef


@lru_cache
def get_llm() -> LLM:
    settings = get_settings()
    if settings.mock_mode:
        from .mock import MockLLM

        return MockLLM(settings)
    from .gemini import GeminiLLM

    return GeminiLLM(settings)


__all__ = ["LLM", "MediaRef", "get_llm"]
