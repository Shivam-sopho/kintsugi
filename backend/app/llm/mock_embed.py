"""Offline stand-in for Gemini Embedding 2.

Maps words from several languages onto shared concepts, then hashes the concepts into a
vector, so that "teak doors", "सागौन के दरवाज़े" and "pintu kayu jati" land close together.
This only exists so the app runs without credentials; live mode uses the real model.
"""

from __future__ import annotations

import hashlib
import math
import re
import unicodedata

from ..vectors import cosine  # noqa: F401  (re-exported for convenience)

CONCEPTS: dict[str, list[str]] = {
    "door": ["door", "doors", "darwaza", "darwaze", "दरवाज़ा", "दरवाज़े", "दरवाजा", "दरवाजे", "pintu", "ಬಾಗಿಲು"],
    "teak": ["teak", "sagwan", "सागौन", "jati", "ತೇಗ"],
    "wood": ["wood", "wooden", "timber", "lakdi", "लकड़ी", "kayu", "ಮರ", "rustic", "warm"],
    "window": ["window", "windows", "khidki", "खिड़की", "jendela", "ಕಿಟಕಿ"],
    "tile": ["tile", "tiles", "टाइल", "ubin", "keramik", "flooring", "floor"],
    "light": ["light", "lights", "lamp", "pendant", "batti", "बत्ती", "lampu", "lighting"],
    "chair": ["chair", "chairs", "kursi", "कुर्सी", "seating"],
    "table": ["table", "mez", "मेज़", "meja", "counter"],
    "steel": ["steel", "iron", "loha", "लोहा", "besi", "metal", "cabinet", "cabinets", "industrial"],
    "aluminium": ["aluminium", "aluminum"],
    "glass": ["glass", "kaanch", "काँच", "kaca"],
    "basin": ["basin", "sink", "washbasin", "wastafel"],
    "brick": ["brick", "bricks", "eent", "ईंट", "bata"],
}
def _norm(s: str) -> str:
    return unicodedata.normalize("NFC", s).lower()


_LOOKUP = {_norm(w): c for c, words in CONCEPTS.items() for w in words}


def _tokens(text: str) -> list[str]:
    raw = re.findall(r"[\wऀ-ॿಀ-೿]+", _norm(text or ""))
    return [_LOOKUP.get(t, t) for t in raw]


def embed(text: str, dim: int) -> list[float]:
    vec = [0.0] * dim
    for tok in _tokens(text):
        weight = 3.0 if tok in CONCEPTS else 1.0
        h = int(hashlib.md5(tok.encode("utf-8")).hexdigest(), 16)
        vec[h % dim] += weight
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]
