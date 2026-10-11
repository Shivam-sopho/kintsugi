"""JSON schemas for Gemini structured output (passed as response_json_schema)."""

SCOUT_SCHEMA = {
    "type": "object",
    "properties": {
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "type": {"type": "string", "description": "Short item type, e.g. 'wooden door', 'chair'"},
                    "description": {"type": "string"},
                    "count": {"type": "integer", "minimum": 1},
                    "condition": {"type": "string", "enum": ["A", "B", "C", "D"]},
                    "condition_reason": {"type": "string"},
                    "components": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "name": {"type": "string"},
                                "material": {"type": "string"},
                                "est_weight_kg": {"type": "number"},
                            },
                            "required": ["name", "material", "est_weight_kg"],
                        },
                    },
                    "dimensions_cm": {
                        "type": "object",
                        "properties": {
                            "width": {"type": "number"},
                            "height": {"type": "number"},
                            "depth": {"type": "number"},
                        },
                    },
                    "timestamps_s": {"type": "array", "items": {"type": "number"}},
                    "hazards": {"type": "array", "items": {"type": "string"}},
                    "tap_test": {"type": "string", "enum": ["solid", "hollow", "unknown"]},
                    "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                },
                "required": ["type", "count", "condition", "components", "confidence"],
            },
        },
        "narration_language": {"type": "string", "description": "BCP-47 code of the spoken narration, if any"},
        "narration_summary_en": {"type": "string"},
    },
    "required": ["items"],
}

ORACLE_SCHEMA = {
    "type": "object",
    "properties": {
        "predictions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "kind": {"type": "string", "enum": ["supply", "demand"]},
                    "title": {"type": "string", "description": "English title"},
                    "address": {"type": "string"},
                    "expected_date": {"type": "string", "description": "ISO date if known"},
                    "expected_materials": {"type": "array", "items": {"type": "string"}},
                    "source_language": {"type": "string"},
                    "source_excerpt": {"type": "string", "description": "Short quote from the document, original language"},
                    "confidence": {"type": "number"},
                },
                "required": ["kind", "title", "address", "confidence"],
            },
        }
    },
    "required": ["predictions"],
}

DESIGN_SCHEMA = {
    "type": "object",
    "properties": {
        "concept": {"type": "string", "description": "Two-sentence design concept in English"},
        "selected": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "item_id": {"type": "string"},
                    "use": {"type": "string", "description": "How the item is used in the space"},
                    "quantity": {"type": "integer"},
                },
                "required": ["item_id", "use", "quantity"],
            },
        },
        "render_prompt": {"type": "string", "description": "Prompt for a photorealistic render of the space"},
    },
    "required": ["concept", "selected", "render_prompt"],
}

MESSAGES_SCHEMA = {
    "type": "object",
    "properties": {
        "en": {"type": "string"},
        "local": {"type": "string"},
    },
    "required": ["en", "local"],
}
