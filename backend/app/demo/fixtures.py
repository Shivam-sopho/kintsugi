"""Sample data for mock mode and judge mode.

Everything here is SYNTHETIC and labelled as such in the UI. Replace the participants with
real ones (Places API + the dealer you interview) and the scans with your own footage.
Demo city: Bengaluru.
"""

from __future__ import annotations

from ..models import GeoPoint, Participant, Prediction

HOME_HSR = GeoPoint(lat=12.9116, lng=77.6474)
OFFICE_KORAMANGALA = GeoPoint(lat=12.9352, lng=77.6245)
CAFE_INDIRANAGAR = GeoPoint(lat=12.9719, lng=77.6412)


def participants() -> list[Participant]:
    return [
        # The person using the app (scans default to them as the seller)
        Participant(id="ppl_me", name="You", role="homeowner", language="en", location=GeoPoint(lat=12.9205, lng=77.6390)),
        Participant(
            id="ppl_ramesh", name="Ramesh Scrap Traders", role="dealer", language="hi",
            location=GeoPoint(lat=12.9406, lng=77.6290),
            accepts_types=["door", "window", "cabinet", "pendant light"],
            accepts_materials=["steel", "copper", "aluminium", "paper", "plastic"],
            min_bundle_value_inr=300, floor_price_inr=None,
        ),
        Participant(
            id="ppl_imran", name="Imran Kabadi", role="dealer", language="hi",
            location=GeoPoint(lat=12.9141, lng=77.6390),
            accepts_types=[], accepts_materials=["steel", "copper", "aluminium", "paper", "plastic"],
            min_bundle_value_inr=250,
        ),
        Participant(
            id="ppl_ananya", name="Ananya (Brew & Bloom café)", role="buyer", language="en",
            location=CAFE_INDIRANAGAR,
            accepts_types=["door", "pendant light", "tile", "wash basin", "window"],
            budget_cap_inr=30000,
        ),
        Participant(
            id="ppl_habitat", name="Homes For All (NGO)", role="ngo", language="kn",
            location=GeoPoint(lat=12.9698, lng=77.7500),
            accepts_types=["window", "door", "wash basin"],
        ),
        Participant(
            id="ppl_lakdi", name="Lakdi Kaam Carpentry", role="repairer", language="hi",
            location=GeoPoint(lat=12.9170, lng=77.6420),
            accepts_types=["chair", "table", "door"],
        ),
        Participant(
            id="ppl_reroot", name="ReRoot Upcycling Studio", role="upcycler", language="en",
            location=GeoPoint(lat=12.9279, lng=77.6271),
            accepts_types=["teak frame", "wooden frame"], accepts_materials=["wood", "glass"],
        ),
        Participant(
            id="ppl_greenloop", name="GreenLoop Textiles", role="recycler", language="en",
            location=GeoPoint(lat=12.9581, lng=77.6480),
            accepts_materials=["textile"],
        ),
        Participant(
            id="ppl_cnd", name="C&D Recycling Yard", role="recycler", language="kn",
            location=GeoPoint(lat=12.9800, lng=77.5800),
            accepts_materials=["ceramic", "brick", "concrete", "stone"],
        ),
        Participant(
            id="ppl_wte", name="City Waste-to-Energy Plant", role="energy_facility", language="kn",
            location=GeoPoint(lat=12.9900, lng=77.5600),
            accepts_materials=["foam", "plastic", "mixed", "textile", "paper"],
        ),
        Participant(
            id="ppl_compost", name="Ward compost and biogas unit, HSR Layout", role="composter", language="kn",
            location=GeoPoint(lat=12.9150, lng=77.6350),
            accepts_materials=["organic"],
        ),
        Participant(
            id="ppl_dwcc", name="Municipal dry waste collection centre, Koramangala", role="government", language="kn",
            location=GeoPoint(lat=12.9330, lng=77.6200),
            accepts_materials=["paper", "plastic", "glass", "textile", "aluminium", "steel"],
        ),
        Participant(
            id="ppl_ewaste", name="Authorised e-waste collection point, Indiranagar", role="government", language="en",
            location=GeoPoint(lat=12.9750, lng=77.6400),
            accepts_materials=["electronics", "copper"],
        ),
        Participant(
            id="ppl_safehaz", name="SafeHaz Licensed Disposal", role="hazard_handler", language="en",
            location=GeoPoint(lat=12.9500, lng=77.6900),
            accepts_materials=["any"],
        ),
    ]


SCOUT_CHAIR = {
    "items": [
        {
            "type": "chair",
            "description": "Wooden dining chair, teak frame, cushioned seat; back leg broken at the joint",
            "count": 1,
            "condition": "D",
            "condition_reason": "Back leg snapped at the joint and the frame is cracked",
            "components": [
                {"name": "teak frame", "material": "teak", "est_weight_kg": 4.0},
                {"name": "steel screws and brackets", "material": "steel", "est_weight_kg": 0.3},
                {"name": "seat cushion", "material": "foam", "est_weight_kg": 1.0},
                {"name": "fabric cover", "material": "fabric", "est_weight_kg": 0.4},
            ],
            "dimensions_cm": {"width": 45, "height": 90, "depth": 50},
            "timestamps_s": [1.5, 6.0],
            "hazards": [],
            "tap_test": "unknown",
            "confidence": 0.9,
        }
    ],
    "narration_language": "hi",
    "narration_summary_en": "Owner says the chair is teak and the leg is broken.",
}

SCOUT_OFFICE = {
    "items": [
        {
            "type": "teak panel door", "description": "Solid teak panel doors with brass hinges", "count": 6,
            "condition": "B", "condition_reason": "Surface scratches only; frames sound",
            "components": [
                {"name": "teak door leaf", "material": "teak", "est_weight_kg": 28.0},
                {"name": "brass hinges and handle", "material": "brass", "est_weight_kg": 0.6},
            ],
            "dimensions_cm": {"width": 90, "height": 210, "depth": 4},
            "timestamps_s": [4.0, 11.5, 19.0], "hazards": [], "tap_test": "solid", "confidence": 0.86,
        },
        {
            "type": "aluminium sliding window", "description": "Two-panel sliding windows, clear glass", "count": 8,
            "condition": "B", "condition_reason": "Tracks dusty, glass intact",
            "components": [
                {"name": "aluminium frame", "material": "aluminium", "est_weight_kg": 6.0},
                {"name": "glass panes", "material": "glass", "est_weight_kg": 9.0},
            ],
            "timestamps_s": [8.0, 22.0], "hazards": [], "confidence": 0.8,
        },
        {
            "type": "vitrified floor tile", "description": "600x600 mm beige vitrified tiles, solid when tapped", "count": 120,
            "condition": "B", "condition_reason": "Firmly bonded; can be lifted with care",
            "components": [{"name": "tile", "material": "ceramic", "est_weight_kg": 8.0}],
            "timestamps_s": [14.0], "hazards": [], "tap_test": "solid", "confidence": 0.7,
        },
        {
            "type": "vitrified floor tile (hollow)", "description": "Tiles near the entrance that sound hollow", "count": 30,
            "condition": "D", "condition_reason": "Hollow sound on tap test: likely detached and cracked beneath",
            "components": [{"name": "tile", "material": "ceramic", "est_weight_kg": 8.0}],
            "timestamps_s": [16.5], "hazards": [], "tap_test": "hollow", "confidence": 0.65,
        },
        {
            "type": "pendant light", "description": "Industrial black metal pendant lights", "count": 10,
            "condition": "B", "condition_reason": "Working; minor paint chips",
            "components": [
                {"name": "steel shade", "material": "steel", "est_weight_kg": 1.2},
                {"name": "wiring", "material": "copper", "est_weight_kg": 0.2},
                {"name": "bulb holder", "material": "plastic", "est_weight_kg": 0.1},
            ],
            "timestamps_s": [25.0], "hazards": [], "confidence": 0.88,
        },
        {
            "type": "steel office cabinet", "description": "Grey two-door steel storage cabinets", "count": 4,
            "condition": "C", "condition_reason": "Dents and rust spots; doors close",
            "components": [{"name": "steel body", "material": "steel", "est_weight_kg": 35.0}],
            "timestamps_s": [30.0], "hazards": [], "confidence": 0.84,
        },
        {
            "type": "wash basin", "description": "White ceramic wall-hung wash basins", "count": 3,
            "condition": "B", "condition_reason": "No cracks seen", "components": [
                {"name": "basin", "material": "ceramic", "est_weight_kg": 12.0},
            ],
            "timestamps_s": [36.0], "hazards": [], "confidence": 0.82,
        },
        {
            "type": "corrugated roofing sheet", "description": "Grey corrugated cement sheets over the rear shed", "count": 12,
            "condition": "C", "condition_reason": "Weathered, some cracks",
            "components": [{"name": "sheet", "material": "concrete", "est_weight_kg": 18.0}],
            "timestamps_s": [44.0], "hazards": ["suspected asbestos cement: professional testing required"],
            "confidence": 0.6,
        },
    ],
    "narration_language": "hi",
    "narration_summary_en": "Site engineer: old office, demolition next month; doors are teak.",
}

# Per-unit sample prices (INR) for mock mode. Live mode uses Gemini with Search grounding.
SAMPLE_PRICES = [
    ("chair", 300, 600, 900),
    ("teak panel door", 4000, 7000, None),
    ("aluminium sliding window", 1500, 2500, None),
    ("vitrified floor tile (hollow)", 0, 0, None),
    ("vitrified floor tile", 40, 70, None),
    ("pendant light", 300, 600, None),
    ("steel office cabinet", 1500, 2500, None),
    ("wash basin", 400, 800, None),
    ("corrugated roofing sheet", 0, 0, None),
]


def predictions() -> list[Prediction]:
    return [
        Prediction(
            id="prd_mill", kind="supply", title="Old textile mill compound due for demolition",
            address="Peenya Industrial Area, Bengaluru", location=GeoPoint(lat=13.0285, lng=77.5197),
            expected_date="2026-11-15", expected_materials=["steel trusses", "bricks", "teak windows"],
            confidence=0.8, source_language="hi",
            source_excerpt="पुरानी मिल का ध्वस्तीकरण 15 नवंबर से",
        ),
        Prediction(
            id="prd_kn", kind="supply", title="Two-storey residential building demolition notice",
            address="Jayanagar 4th Block, Bengaluru", location=GeoPoint(lat=12.9250, lng=77.5838),
            expected_date="2026-12-01", expected_materials=["doors", "windows", "granite slabs"],
            confidence=0.7, source_language="kn", source_excerpt="ಕಟ್ಟಡ ಕೆಡವುವ ಸೂಚನೆ",
        ),
        Prediction(
            id="prd_office", kind="supply", title="Office floor lease ends; fit-out to be stripped",
            address="Koramangala 5th Block, Bengaluru", location=OFFICE_KORAMANGALA,
            expected_date="2026-10-30", expected_materials=["doors", "lights", "tiles", "cabinets"],
            confidence=0.9, source_language="en", source_excerpt="Premises to be handed over bare-shell",
        ),
        Prediction(
            id="prd_cafe", kind="demand", title="New café fit-out needs doors, lights and tiles",
            address="Indiranagar 100 Ft Road, Bengaluru", location=CAFE_INDIRANAGAR,
            expected_date="2026-11-05", expected_materials=["wooden doors", "pendant lights", "floor tiles"],
            confidence=0.85, source_language="en", source_excerpt="Interior works tender",
        ),
        Prediction(
            id="prd_ngo", kind="demand", title="Affordable housing project needs windows and basins",
            address="Whitefield, Bengaluru", location=GeoPoint(lat=12.9698, lng=77.7500),
            expected_date="2026-12-10", expected_materials=["windows", "wash basins", "doors"],
            confidence=0.75, source_language="kn", source_excerpt="",
        ),
    ]


# Negotiation message templates for mock mode: (english, hindi)
NEGOTIATION_TEMPLATES = {
    # Hindi lines avoid gendered first-person verbs, since the speaker can be anyone.
    ("seller", "offer"): (
        "Hello! The {item} are in good condition. I can give them for ₹{price}.",
        "नमस्ते! माल अच्छी हालत में है। ₹{price} में दिया जा सकता है।",
    ),
    ("seller", "counter"): (
        "I can come down to ₹{price}. It's good material.",
        "₹{price} तक कम हो सकता है, माल बढ़िया है।",
    ),
    ("seller", "final"): (
        "₹{price} is my lowest. It's solid material.",
        "₹{price} से कम नहीं हो पाएगा, माल पक्का है।",
    ),
    ("seller", "accept"): (
        "Okay, ₹{price} final. When will you pick up?",
        "ठीक है, ₹{price} पक्का। पिकअप कब होगा?",
    ),
    ("seller", "decline"): (
        "Sorry, I can't do it at this price.",
        "माफ़ कीजिए, इस दाम में नहीं हो पाएगा।",
    ),
    ("buyer", "offer"): (
        "These are useful to us. Could you do ₹{price} for all of them?",
        "ये हमारे काम के हैं। क्या सभी ₹{price} में दे देंगे?",
    ),
    ("buyer", "counter"): (
        "We can go up to ₹{price}, and we'll handle pickup.",
        "हम ₹{price} तक दे सकते हैं, पिकअप हम करेंगे।",
    ),
    ("buyer", "final"): (
        "₹{price} is the most we can do, with pickup on us.",
        "₹{price} से ज़्यादा नहीं हो पाएगा, पिकअप हम करेंगे।",
    ),
    ("buyer", "accept"): (
        "Deal at ₹{price}. Thank you!",
        "₹{price} पर सौदा पक्का। धन्यवाद!",
    ),
    ("buyer", "decline"): (
        "Sorry, that's above our budget.",
        "माफ़ कीजिए, यह हमारे बजट से ज़्यादा है।",
    ),
}


# Neighbours on the same street as the chair, used to show pickup bundling.
NEIGHBOURS = [
    {
        "name": "Neighbour 1, HSR Layout Sector 2",
        "location": GeoPoint(lat=12.9124, lng=77.6481),
        "scan": {"items": [{
            "type": "pressure cooker", "description": "Old aluminium pressure cooker, lid seal gone",
            "count": 1, "condition": "D", "condition_reason": "Warped base",
            "components": [{"name": "cooker body", "material": "aluminium", "est_weight_kg": 2.5}],
            "hazards": [], "confidence": 0.9,
        }]},
    },
    {
        "name": "Neighbour 2, HSR Layout Sector 2",
        "location": GeoPoint(lat=12.9109, lng=77.6466),
        "scan": {"items": [{
            "type": "steel bucket", "description": "Rusted steel bucket with a hole",
            "count": 1, "condition": "D", "condition_reason": "Hole in the base",
            "components": [{"name": "bucket", "material": "steel", "est_weight_kg": 1.5}],
            "hazards": [], "confidence": 0.9,
        }]},
    },
    {
        "name": "Neighbour 3, HSR Layout Sector 2",
        "location": GeoPoint(lat=12.9131, lng=77.6460),
        "scan": {"items": [{
            "type": "newspaper stack", "description": "About three months of newspapers",
            "count": 1, "condition": "D", "condition_reason": "Read",
            "components": [{"name": "newspapers", "material": "paper", "est_weight_kg": 12.0}],
            "hazards": [], "confidence": 0.95,
        }]},
    },
    {
        "name": "Neighbour 4, HSR Layout Sector 2",
        "location": GeoPoint(lat=12.9131, lng=77.6459),
        "scan": {"items": [{
            "type": "garden waste", "description": "Two sacks of dry leaves and coconut fronds from a garden",
            "count": 2, "condition": "D", "condition_reason": "Organic waste, cannot be reused",
            "components": [{"name": "leaves and fronds", "material": "organic", "est_weight_kg": 9.0}],
            "hazards": [], "confidence": 0.95,
        }]},
    }
]


# Offline stand-ins for voice input, keyed by where the mic button is: (text, language, english)
SAMPLE_TRANSCRIPTS = {
    "notes": ("कुर्सी का पैर टूट गया है, सागौन की है", "hi", "The chair's leg is broken; it's teak."),
    "search": ("सागौन के दरवाज़े", "hi", "teak doors"),
    "brief": ("Cozy café, about 40 square metres, warm wood", "en", "Cozy café, about 40 square metres, warm wood"),
    "floor": ("पच्चीस हज़ार से कम नहीं", "hi", "Not less than twenty-five thousand"),
    "listing": ("मेरे पास बारह पुरानी सागौन की खिड़कियाँ हैं, अच्छी हालत में", "hi",
                "I have twelve old teak windows in good condition."),
}
SAMPLE_AMOUNTS = {"floor": 25000}

# A dealer's voice-note listing (no photo): what Scout hears.
SCOUT_VOICE_LISTING = {
    "items": [{
        "type": "teak window frame", "description": "Old teak window frames, described in a voice note",
        "count": 12, "condition": "B", "condition_reason": "Seller says they are in good condition (not yet seen)",
        "components": [
            {"name": "teak frame", "material": "teak", "est_weight_kg": 9.0},
            {"name": "glass pane", "material": "glass", "est_weight_kg": 4.0},
        ],
        "hazards": [], "confidence": 0.5,
    }],
    "narration_language": "hi",
    "narration_summary_en": "Dealer: I have twelve old teak windows in good condition.",
}

# Take-apart steps for mock mode: item type -> (english steps, hindi steps)
TAKE_APART = {
    "chair": (
        [
            "Wear gloves and lay the chair on its side on a mat.",
            "Remove the fabric cover and keep it aside for textile recycling.",
            "Lift out the foam cushion and keep it dry in a bag.",
            "Unscrew the steel brackets with a screwdriver and collect the screws in a tin.",
            "Stack the teak frame pieces together for the upcycling studio.",
        ],
        [
            "दस्ताने पहनें और कुर्सी को चटाई पर एक तरफ़ लिटा दें।",
            "कपड़े का कवर उतारें और कपड़ा रीसाइक्लिंग के लिए अलग रखें।",
            "फ़ोम की गद्दी निकालें और उसे थैले में सूखा रखें।",
            "पेचकस से स्टील के ब्रैकेट खोलें और पेंच एक डिब्बे में रखें।",
            "सागौन की लकड़ी के हिस्से अपसाइक्लिंग स्टूडियो के लिए एक साथ रखें।",
        ],
    ),
}
