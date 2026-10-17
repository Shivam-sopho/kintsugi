"""Ask Kintsugi: answers from the person's own data, in their language, with a safe suggested action."""

import asyncio
import json

from app import agents
from app.config import get_settings
from app.llm.mock import MockLLM
from app.store import get_store

from .test_features import client, scan, wait  # noqa: F401  (pytest fixture and helpers)


def test_proactive_greeting_and_a_question_by_text(client):
    scan(client, kind="home", seller_id="ppl_me")
    greet = client.post("/api/ask", data={"persona_id": "ppl_me"}).json()
    assert greet["answer"] and greet["used"]["items"] >= 1
    assert greet["action"]["type"] in agents.ASK_ACTIONS
    reply = client.post("/api/ask", data={"persona_id": "ppl_me", "question": "What happens to my chair?",
                                          "history": json.dumps([{"role": "kintsugi", "text": greet["answer"]}])}).json()
    assert reply["answer"] and reply["heard"] is None


def test_a_question_by_voice_is_transcribed_first(client):
    r = client.post("/api/ask", data={"persona_id": "ppl_me"},
                    files={"file": ("ask.webm", b"fake audio", "audio/webm")}).json()
    assert r["heard"]["text"] and r["answer"]


def test_private_limits_never_reach_the_model(client):
    it = next(i for i in scan(client, seller_id="ppl_ramesh") if not i["hazards"])
    client.patch(f"/api/items/{it['id']}", json={"floor_price_inr": 98765})
    body = {"buyer_id": "ppl_ananya", "query": "teak door", "lat": 12.93, "lng": 77.62, "cap_inr": 45678, "auto_approve": True}
    wait(client, client.post("/api/requests", json=body).json()["id"])
    store = get_store()
    for persona in ("ppl_ramesh", "ppl_ananya"):
        text = json.dumps(agents.ask_context(store, persona, agents.GeoPoint(lat=12.95, lng=77.63)))
        assert "98765" not in text and "45678" not in text
        assert "floor_price_inr" not in text and "cap_inr" not in text


def test_suggested_actions_are_kept_to_what_the_person_can_do(client):
    class Wild(MockLLM):
        async def ask(self, question, history, context, lang):
            return {"answer": "x", "answer_en": "x", "language": "en",
                    "action": {"type": "offer_item", "item_id": "itm_not_theirs", "label": "Offer"}}

    out = asyncio.run(agents.ask_kintsugi(get_store(), Wild(get_settings()), get_settings(), "ppl_me", "sell it", [], "en"))
    assert out["action"]["type"] == "none"


def test_the_reply_follows_the_language_of_the_question():
    assert agents.reply_language("Which of my things is worth the most?", "hi") == "en"
    assert agents.reply_language("मेरे टाइल्स का क्या होगा?", "en") == "hi"
    assert agents.reply_language("ಇ-ತ್ಯಾಜ್ಯ ಎಲ್ಲಿ ಕೊಡಬಹುದು?", "en") == "kn"
    assert agents.reply_language("", "kn") == "kn"  # the greeting uses the profile's language


def test_southeast_asian_questions_are_answered_in_their_language():
    assert agents.reply_language("Barang saya ini bisa dibawa ke mana?", "en") == "id"
    assert agents.reply_language("Barang saya ini bisa dibawa ke mana?", "ms") == "ms"
    assert agents.reply_language("ตู้ไม้เก่าของฉันจะไปไหน", "en") == "th"
    assert agents.reply_language("Cái tủ gỗ cũ của tôi sẽ đi đâu?", "en") == "vi"
    assert agents.reply_language("Saan ko po dadalhin ang mga lumang upuan?", "en") == "fil"
    assert agents.reply_language("Where can my old door go?", "id") == "en"
    assert agents.reply_language("古い椅子はどこに持っていけますか？", "en") == "ja"
