"""Agent-to-agent negotiation with hard guardrails.

Prices come from a bounded concession strategy (or an optional proposer, e.g. a model);
the seller's floor and the buyer's cap are enforced here in code, never only in a prompt.
The model's job is the wording, in each person's language.

Transport: the two agents currently talk in-process. The plan is to expose the seller and
buyer agents as A2A services on Thu 15 Oct; `run_negotiation` only needs the two `decide`
calls swapped for A2A requests.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Awaitable, Callable, Literal, Optional, Protocol

from .models import NegotiationTurn, Settlement

Side = Literal["seller", "buyer"]
Proposer = Callable[[Side, float, float, int], Optional[float]]  # (side, own_last, other_last, round) -> price


class Voice(Protocol):
    async def negotiation_message(
        self, role: str, action: str, price: float, item_summary: str, local_lang: str
    ) -> dict[str, str]: ...


@dataclass
class NegotiationSetup:
    item_summary: str
    list_price: float
    seller_floor: float  # private to the seller agent
    buyer_cap: float  # private to the buyer agent
    seller_lang: str = "hi"
    buyer_lang: str = "en"
    max_rounds: int = 8
    concession: float = 0.4  # share of the gap each side gives up per turn
    tolerance: float = 0.03  # close the deal when the gap is within 3% of the ask


@dataclass
class NegotiationResult:
    status: Literal["agreed", "no_deal"]
    final_price: Optional[float]
    transcript: list[NegotiationTurn]


def _round_price(p: float) -> float:
    step = 50 if p >= 1000 else 10
    return float(round(p / step) * step)


def clamp(side: Side, price: float, setup: NegotiationSetup) -> tuple[float, bool]:
    """Enforce the private limits. Returns (price, guardrail_applied)."""
    if side == "seller" and price < setup.seller_floor:
        return setup.seller_floor, True
    if side == "buyer" and price > setup.buyer_cap:
        return setup.buyer_cap, True
    return price, False


async def run_negotiation(
    setup: NegotiationSetup,
    voice: Voice,
    on_turn: Optional[Callable[[NegotiationTurn], Awaitable[None]]] = None,
    proposer: Optional[Proposer] = None,
) -> NegotiationResult:
    transcript: list[NegotiationTurn] = []
    langs = {"seller": setup.seller_lang, "buyer": setup.buyer_lang}

    async def say(side: Side, action: str, price: float, rnd: int, guard: bool, note: str = "") -> None:
        other = "buyer" if side == "seller" else "seller"
        # The voice writes the message in English and in the *other* party's language when it
        # differs, so each person reads every turn in their own language.
        local_lang = langs[other] if langs[other] != "en" else langs[side]
        msg = await voice.negotiation_message(side, action, price, setup.item_summary, local_lang)
        messages = {"en": msg["en"]}
        if local_lang != "en":
            messages[local_lang] = msg["local"]
        turn = NegotiationTurn(
            round=rnd, speaker=side, action=action, price_inr=price, messages=messages,
            guardrail_applied=guard, guardrail_note=note,
        )
        transcript.append(turn)
        if on_turn:
            await on_turn(turn)

    def propose(side: Side, own: float, other: float, rnd: int, default: float) -> tuple[float, bool, str]:
        raw = proposer(side, own, other, rnd) if proposer else None
        price = _round_price(raw if raw is not None else default)
        clamped, guard = clamp(side, price, setup)
        note = ""
        if guard:
            limit = "floor" if side == "seller" else "budget cap"
            note = f"Proposed ₹{price:,.0f} broke the {side}'s {limit}; held at ₹{clamped:,.0f}"
        return clamped, guard, note

    # Opening moves
    rnd = 1
    ask, g, n = propose("seller", 0, 0, rnd, max(setup.list_price, setup.seller_floor * 1.15))
    await say("seller", "offer", ask, rnd, g, n)

    rnd += 1
    bid, g, n = propose("buyer", 0, ask, rnd, min(setup.buyer_cap, ask * 0.6))
    if bid >= ask:
        await say("buyer", "accept", ask, rnd, g, n)
        return NegotiationResult("agreed", ask, transcript)
    await say("buyer", "offer", bid, rnd, g, n)

    while rnd < setup.max_rounds:
        # Seller moves
        rnd += 1
        new_ask, g, n = propose("seller", ask, bid, rnd, ask - setup.concession * (ask - bid))
        if new_ask <= bid or (new_ask - bid) <= setup.tolerance * ask:
            if bid >= setup.seller_floor:
                await say("seller", "accept", bid, rnd, g, n)
                return NegotiationResult("agreed", bid, transcript)
        seller_stuck = new_ask >= ask
        ask = max(new_ask, setup.seller_floor)
        await say("seller", "counter", ask, rnd, g, n)

        # Buyer moves
        rnd += 1
        new_bid, g, n = propose("buyer", bid, ask, rnd, bid + setup.concession * (ask - bid))
        if new_bid >= ask or (ask - new_bid) <= setup.tolerance * ask:
            if ask <= setup.buyer_cap:
                await say("buyer", "accept", ask, rnd, g, n)
                return NegotiationResult("agreed", ask, transcript)
        buyer_stuck = new_bid <= bid
        bid = min(new_bid, setup.buyer_cap)
        if seller_stuck and buyer_stuck:
            break  # neither side can move: their private limits do not overlap
        await say("buyer", "counter", bid, rnd, g, n)

    await say("buyer", "decline", bid, rnd + 1, False)
    return NegotiationResult("no_deal", None, transcript)


def sandbox_settlement(deal_id: str, buyer_id: str, seller_id: str, item_lines: list[dict], total_inr: float) -> Settlement:
    """Build a sandbox settlement record shaped like AP2's mandates. Moves no money."""
    now = time.time()
    return Settlement(
        intent_mandate={
            "user": buyer_id,
            "intent": "Buy reclaimed materials listed in the cart",
            "max_amount_inr": total_inr,
            "requires_human_approval": True,
            "approved_at": now,
        },
        cart_mandate={"deal_id": deal_id, "merchant": seller_id, "items": item_lines, "total_inr": total_inr, "currency": "INR"},
        payment_mandate={
            "amount_inr": total_inr,
            "method": "sandbox",
            "status": "settled_sandbox",
            "reference": f"sbx_{deal_id}",
        },
        settled_at=now,
    )
