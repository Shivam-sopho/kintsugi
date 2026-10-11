import asyncio

from app.config import get_settings
from app.llm.mock import MockLLM
from app.negotiation import NegotiationSetup, run_negotiation

VOICE = MockLLM(get_settings())


def run(setup, proposer=None):
    return asyncio.run(run_negotiation(setup, VOICE, proposer=proposer))


def test_agrees_within_limits_with_messages_in_both_languages():
    s = NegotiationSetup(item_summary="6 teak doors", list_price=48000, seller_floor=24300, buyer_cap=30000)
    r = run(s)
    assert r.status == "agreed"
    assert s.seller_floor <= r.final_price <= s.buyer_cap
    assert all({"en", "hi"} <= set(t.messages) for t in r.transcript)
    assert len(r.transcript) <= s.max_rounds


def test_guardrails_hold_against_a_misbehaving_proposer():
    # A proposer that tries to give everything away on both sides.
    rogue = lambda side, own, other, rnd: 1.0 if side == "seller" else 1_000_000.0
    s = NegotiationSetup(item_summary="lights", list_price=6000, seller_floor=3000, buyer_cap=4000)
    r = run(s, proposer=rogue)
    for t in r.transcript:
        if t.speaker == "seller":
            assert t.price_inr >= s.seller_floor
        else:
            assert t.price_inr <= s.buyer_cap
    assert any(t.guardrail_applied for t in r.transcript)


def test_no_deal_when_limits_do_not_overlap():
    s = NegotiationSetup(item_summary="doors", list_price=50000, seller_floor=40000, buyer_cap=20000)
    r = run(s)
    assert r.status == "no_deal"
    assert r.final_price is None
    assert r.transcript[-1].action == "decline"
