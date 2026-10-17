"""Material names, aliases (including Hindi and Bahasa words) and emission factors."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

# Map free-text material names (as Gemini or a user might write them) to canonical keys.
ALIASES: dict[str, str] = {
    # wood
    "wood": "wood", "timber": "wood", "teak": "wood", "plywood": "wood", "mdf": "wood",
    "hardwood": "wood", "softwood": "wood", "sagwan": "wood", "lakdi": "wood", "lakdee": "wood",
    "लकड़ी": "wood", "सागौन": "wood", "kayu": "wood", "jati": "wood", "kayu jati": "wood",
    # metals
    "steel": "steel", "iron": "steel", "mild steel": "steel", "stainless steel": "steel",
    "loha": "steel", "लोहा": "steel", "besi": "steel",
    "aluminium": "aluminium", "aluminum": "aluminium",
    "copper": "copper", "tamba": "copper", "तांबा": "copper", "brass": "copper",
    # minerals
    "glass": "glass", "kaanch": "glass", "काँच": "glass", "kaca": "glass",
    "ceramic": "ceramic", "porcelain": "ceramic", "tile": "ceramic", "tiles": "ceramic",
    "vitrified": "ceramic", "keramik": "ceramic",
    "brick": "brick", "eent": "brick", "ईंट": "brick", "bata": "brick",
    "concrete": "concrete", "cement": "concrete",
    "stone": "stone", "granite": "stone", "marble": "stone", "kota stone": "stone",
    # polymers and soft goods
    "plastic": "plastic", "pvc": "plastic", "polypropylene": "plastic", "acrylic": "plastic",
    "foam": "foam", "polyurethane": "foam", "pu foam": "foam", "sponge": "foam",
    "fabric": "textile", "textile": "textile", "cotton": "textile", "polyester": "textile",
    "kapda": "textile", "कपड़ा": "textile", "kain": "textile",
    "paper": "paper", "cardboard": "paper",
    "electronics": "electronics", "e-waste": "electronics", "wiring": "copper",
    # organic (compost or biogas)
    "organic": "organic", "food": "organic", "food waste": "organic", "kitchen waste": "organic",
    "garden waste": "organic", "leaves": "organic", "vegetable": "organic", "fruit": "organic",
    "coconut": "organic", "cow dung": "organic", "biomass": "organic", "wet waste": "organic",
    "गीला कचरा": "organic", "खाद": "organic", "ಹಸಿ ಕಸ": "organic",
}


def canonical_material(name: str) -> str:
    key = (name or "").strip().lower()
    if key in ALIASES:
        return ALIASES[key]
    # Longest alias first, so "textile" wins over "tile" and "kayu jati" over "kayu".
    for alias in sorted(ALIASES, key=len, reverse=True):
        if alias in key:
            return ALIASES[alias]
    return "mixed"


@lru_cache
def _factors_file() -> dict:
    return json.loads((DATA_DIR / "emission_factors.json").read_text(encoding="utf-8"))


def emission_factor(material: str) -> float:
    factors = _factors_file()["factors"]
    return float(factors.get(canonical_material(material), factors["mixed"]))


def rung_credit(rung: str) -> float:
    return float(_factors_file()["rung_credit"].get(rung, 0.0))


def factor_source() -> str:
    return _factors_file()["source"]
