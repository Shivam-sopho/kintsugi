"""Sample cities across Asia-Pacific (sample data, labelled as such), so the map, the journey and
the ledger work wherever a judge is. Every taker and person here is invented; no real organisation
is named. Each city has the same kinds of takers as the Bengaluru demo, in its own language, and two
homes with things listed. The app's rules route each item and the ledger counts it, exactly as for
a real scan. Prices are in rupees, like the rest of the prototype."""

from __future__ import annotations

from typing import Any

# (id, name, language, centre lat, lng, the takers' names by role, the two homes' owners)
CITIES: list[dict[str, Any]] = [
    {"id": "sg", "name": "Singapore", "lang": "en", "center": (1.3343, 103.8563),
     "takers": {"dealer": "Ah Huat Karung Guni", "buyer": "Kopi & Timber Café", "ngo": "Fresh Start Homes (charity)",
                "repairer": "Fix-It Furniture Workshop", "textile": "ReWeave Textiles", "cnd": "Island C&D Recovery Yard",
                "government": "Town council recycling point", "composter": "Neighbourhood food-waste digester",
                "energy_facility": "Waste-to-energy plant", "hazard_handler": "Licensed hazardous waste collector"},
     "homes": ("Mei Ling", "Arjun")},
    {"id": "tyo", "name": "Tokyo", "lang": "ja", "center": (35.6466, 139.6533),
     "takers": {"dealer": "Yamada Recycle Shop (リサイクルショップ山田)", "buyer": "Ki to Kohi café (木と珈琲)",
                "ngo": "Minna no Ie (みんなの家, charity)", "repairer": "Takumi furniture repair (家具修理たくみ)",
                "textile": "Yui textile recycling (古着リサイクル結)", "cnd": "Setagaya construction recycling centre",
                "government": "Ward resource collection centre (区の資源回収センター)", "composter": "Community food-waste compost centre",
                "energy_facility": "Ward incineration and power plant (清掃工場)", "hazard_handler": "Licensed industrial waste handler"},
     "homes": ("Sato Haruka", "Tanaka Ken")},
    {"id": "jkt", "name": "Jakarta", "lang": "id", "center": (-6.2425, 106.7990),
     "takers": {"dealer": "Pak Budi Barang Bekas", "buyer": "Kopi Kayu Café", "ngo": "Rumah Harapan (charity)",
                "repairer": "Bengkel Mebel Jaya", "textile": "Kain Kembali textile recycling", "cnd": "Depo Puing Kebayoran (C&D yard)",
                "government": "Bank Sampah RW 05 (waste bank)", "composter": "Rumah Kompos Kelurahan",
                "energy_facility": "Waste-to-energy plant", "hazard_handler": "Pengelola Limbah B3 berizin (licensed)"},
     "homes": ("Siti Rahma", "Andi Wijaya")},
    {"id": "bkk", "name": "Bangkok", "lang": "th", "center": (13.7797, 100.5446),
     "takers": {"dealer": "Saleng Somchai scrap (ซาเล้งสมชาย)", "buyer": "Baan Mai Café", "ngo": "Baan Rak (บ้านรัก, charity)",
                "repairer": "Chang Fai furniture repair", "textile": "Pha Mai textile recycling", "cnd": "Phaya Thai C&D recovery yard",
                "government": "District recycling centre (เขตพญาไท)", "composter": "District compost site",
                "energy_facility": "Waste-to-energy plant", "hazard_handler": "Licensed hazardous waste handler"},
     "homes": ("Nok Srisuk", "Krit Wongsa")},
    {"id": "mnl", "name": "Manila", "lang": "fil", "center": (14.6297, 121.0370),
     "takers": {"dealer": "Mang Jun Junk Shop", "buyer": "Kahoy Café", "ngo": "Bahay Pag-asa (charity)",
                "repairer": "Ayos Furniture Repair", "textile": "Tela Muli textile recycling", "cnd": "Quezon City C&D recovery yard",
                "government": "Barangay materials recovery facility", "composter": "Barangay composting site",
                "energy_facility": "Waste-to-energy plant", "hazard_handler": "Licensed hazardous waste transporter"},
     "homes": ("Maria Santos", "Paolo Reyes")},
    {"id": "kul", "name": "Kuala Lumpur", "lang": "ms", "center": (3.1300, 101.6713),
     "takers": {"dealer": "Ah Seng Barang Lusuh", "buyer": "Kopi Kayu Bangsar", "ngo": "Rumah Harapan KL (charity)",
                "repairer": "Bengkel Perabot Ali", "textile": "Kain Semula textiles", "cnd": "Bangsar C&D recovery yard",
                "government": "Council recycling centre (Pusat Kitar Semula)", "composter": "Community compost site",
                "energy_facility": "Waste-to-energy plant", "hazard_handler": "Licensed scheduled-waste contractor"},
     "homes": ("Nurul Aina", "Wei Jie")},
    {"id": "sgn", "name": "Ho Chi Minh City", "lang": "vi", "center": (10.7840, 106.6860),
     "takers": {"dealer": "Ve Chai Cô Lan (scrap collector)", "buyer": "Cà Phê Gỗ", "ngo": "Mái Ấm Hy Vọng (charity)",
                "repairer": "Sửa Đồ Gỗ Minh (furniture repair)", "textile": "Vải Tái Sinh textiles", "cnd": "District 3 C&D recovery yard",
                "government": "Ward recycling point (phường)", "composter": "Community compost site",
                "energy_facility": "Waste-to-energy plant", "hazard_handler": "Licensed hazardous waste handler"},
     "homes": ("Nguyễn Lan", "Trần Minh")},
    {"id": "syd", "name": "Sydney", "lang": "en", "center": (-33.9106, 151.1554),
     "takers": {"dealer": "Marrickville Salvage & Scrap", "buyer": "Timber & Brew Café", "ngo": "Second Chance Homes (charity)",
                "repairer": "Mend Furniture Workshop", "textile": "Loop Textiles", "cnd": "Inner West C&D recovery yard",
                "government": "Council resource recovery centre", "composter": "Community compost hub",
                "energy_facility": "Energy-from-waste facility", "hazard_handler": "Licensed hazardous waste contractor"},
     "homes": ("Olivia Chen", "Jack Murphy")},
]

# Every city's takers, by role: (role in the app, offset from the centre in degrees, what they take)
TAKERS: list[tuple[str, str, tuple[float, float], list[str], list[str]]] = [
    ("dealer", "dealer", (0.010, 0.012), ["door", "window", "cabinet", "almirah"], ["steel", "copper", "aluminium", "paper", "plastic"]),
    ("buyer", "buyer", (0.022, -0.008), ["door", "pendant light", "tile", "wash basin", "window", "table"], []),
    ("ngo", "ngo", (-0.018, 0.020), ["window", "door", "wash basin", "chair", "table", "almirah"], []),
    ("repairer", "repairer", (0.006, -0.015), ["chair", "table", "door"], []),
    ("textile", "recycler", (-0.012, -0.010), [], ["textile"]),
    ("cnd", "recycler", (0.030, 0.025), [], ["ceramic", "brick", "concrete", "stone"]),
    ("government", "government", (-0.006, 0.006), [], ["paper", "plastic", "glass", "textile", "aluminium", "steel", "electronics", "copper"]),
    ("composter", "composter", (0.004, 0.018), [], ["organic"]),
    ("energy_facility", "energy_facility", (0.040, -0.030), [], ["foam", "plastic", "mixed", "textile", "paper"]),
    ("hazard_handler", "hazard_handler", (-0.030, -0.025), [], ["any"]),
]

# Two homes per city: someone moving out, and someone renovating
HOMES: list[tuple[str, tuple[float, float], list[dict[str, Any]]]] = [
    ("Moving out", (0.003, 0.004), [
        {"type": "chair", "description": "Wooden dining chair; a back leg is broken at the joint", "count": 2, "condition": "D",
         "components": [("wooden frame", "wood", 4.0), ("steel screws and brackets", "steel", 0.3), ("seat cushion", "foam", 1.0),
                        ("fabric cover", "textile", 0.4)], "value": (300, 600), "repair": 900},
        {"type": "steel almirah", "description": "Two-door steel cupboard, some rust at the base", "count": 1, "condition": "C",
         "components": [("steel body", "steel", 38.0)], "value": (1500, 2500)},
        {"type": "old clothes and bedsheets", "description": "A bag of worn cotton clothes and bedsheets", "count": 1, "condition": "C",
         "components": [("cotton clothes and sheets", "textile", 6.0)], "value": None},
        {"type": "kitchen and garden waste", "description": "Vegetable peels and garden clippings from clearing the flat", "count": 1,
         "condition": "C", "components": [("food and garden waste", "organic", 12.0)], "value": None},
    ]),
    ("Renovating", (-0.004, -0.003), [
        {"type": "wooden panel door", "description": "Solid wooden panel door with brass handle", "count": 2, "condition": "B",
         "components": [("door leaf", "wood", 26.0), ("brass handle and hinges", "copper", 0.6)], "value": (4000, 6500)},
        {"type": "wash basin", "description": "White ceramic wash basin, no cracks", "count": 1, "condition": "B",
         "components": [("ceramic basin", "ceramic", 9.0)], "value": (500, 900)},
        {"type": "floor tile", "description": "Glazed floor tiles lifted whole during the renovation", "count": 60, "condition": "B",
         "components": [("glazed tile", "ceramic", 1.6)], "value": (40, 70)},
        {"type": "broken floor tile", "description": "Cracked tiles and grout rubble", "count": 1, "condition": "D",
         "components": [("tile and grout rubble", "ceramic", 45.0)], "value": None},
        {"type": "old ceiling fan", "description": "Ceiling fan that no longer turns", "count": 1, "condition": "D",
         "components": [("copper motor winding", "copper", 1.2), ("aluminium blades", "aluminium", 1.5), ("wiring and switch", "electronics", 0.5)],
         "value": (250, 400)},
    ]),
]


def city(cid: str) -> dict[str, Any] | None:
    return next((c for c in CITIES if c["id"] == cid), None)
