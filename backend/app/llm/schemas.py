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
                                "material": {
                                    "type": "string",
                                    "enum": ["wood", "steel", "aluminium", "copper", "glass", "ceramic", "brick", "concrete",
                                             "stone", "plastic", "foam", "textile", "paper", "electronics", "organic"],
                                },
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
                    "media_index": {"type": "integer", "description": "0-based index of the file the item is seen in"},
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

EXPLAIN_SCHEMA = {
    "type": "object",
    "properties": {
        "afterlives": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "use": {"type": "string"},
                    "next_life": {"type": "string", "enum": ["reuse", "repair", "upcycle", "harvest_parts", "recycle",
                                                             "compost", "recover_energy", "safe_disposal"]},
                    "how": {"type": "string"},
                },
                "required": ["use", "next_life", "how"],
            },
        },
        "headline": {"type": "string"},
        "parts": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {"part": {"type": "string"}, "goes_to": {"type": "string"}, "happens": {"type": "string"}},
                "required": ["part", "happens"],
            },
        },
        "you_can": {"type": "array", "items": {"type": "string"}},
        "why": {"type": "string"},
    },
    "required": ["afterlives", "headline", "parts", "you_can", "why"],
}

ASK_SCHEMA = {
    "type": "object",
    "properties": {
        "answer": {"type": "string", "description": "The spoken reply, in the person's language and script"},
        "answer_en": {"type": "string", "description": "The same reply in English"},
        "language": {"type": "string", "description": "BCP-47 code of the reply, e.g. hi, kn, en"},
        "action": {
            "type": "object",
            "description": "One suggested action for the person to confirm, or type none",
            "properties": {
                "type": {"type": "string", "enum": ["none", "offer_item", "autopilot_on", "keep_looking", "open_item"]},
                "item_id": {"type": "string"},
                "query": {"type": "string", "description": "For keep_looking: what to look for"},
                "label": {"type": "string", "description": "Short button text in the person's language"},
            },
            "required": ["type"],
        },
    },
    "required": ["answer", "answer_en", "language", "action"],
}

TRANSLATE_SCHEMA = {
    "type": "object",
    "properties": {"text": {"type": "string", "description": "The message in the target language"}},
    "required": ["text"],
}

MESSAGES_SCHEMA = {
    "type": "object",
    "properties": {
        "en": {"type": "string"},
        "local": {"type": "string"},
    },
    "required": ["en", "local"],
}

TRANSCRIBE_SCHEMA = {
    "type": "object",
    "properties": {
        "text": {"type": "string", "description": "Exact transcript in the spoken language and script"},
        "language": {"type": "string", "description": "BCP-47 code, e.g. hi, kn, en"},
        "english": {"type": "string", "description": "English translation"},
        "amount_inr": {"type": "number", "description": "If a price or amount is spoken, its value in rupees"},
    },
    "required": ["text", "language", "english"],
}

TAKE_APART_SCHEMA = {
    "type": "object",
    "properties": {
        "en": {"type": "array", "items": {"type": "string"}},
        "local": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["en", "local"],
}
