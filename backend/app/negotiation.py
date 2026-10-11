"""Agent-to-agent negotiation with hard guardrails.

Each side is its own agent with private limits: the seller agent knows only its floor, the
buyer agent only its budget cap. Prices come from a bounded concession strategy (or an optional
proposer, e.g. a model); the limits are enforced here in code, never only in a prompt. The model's
job is the wording, in each person's language.

Transport: the buyer side talks to the seller agent through a `SellerPort`. `LocalSeller` runs the
seller in-process (tests, fallback); `a2a_seller.A2ASeller` talks to the seller agent over the A2A
protocol, so the seller's floor never leaves the seller agent.
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
    max_rounds: int = 12
    concession: float = 0.4  # share of the gap each side gives up per turn
    tolerance: float = 0.03  # close the deal when the gap is within 3% of the ask


@dataclass
class NegotiationResult:
    status: Literal["agreed", "no_deal"]
    final_price: Optional[float]
    transcript: list[NegotiationTurn]


@dataclass
class Move:
    action: Literal["offer", "counter", "final", "accept", "decline"]
    price: float
    guard: bool = False
    note: str = ""
    stuck: bool = False  # this side could not concede further


def _round_price(p: float) -> float:
    step = 50 if p >= 1000 else 10
    return float(round(p / step) * step)


@dataclass(kw_only=True)
class _Brain:
    side: Side = "seller"
    limit: float = 0.0  # seller: floor (min), buyer: cap (max)
    concession: float = 0.4
    tolerance: float = 0.03
    proposer: Optional[Proposer] = None

    def clamp(self, price: float) -> tuple[float, bool]:
        if self.side == "seller" and price < self.limit:
            return self.limit, True
        if self.side == "buyer" and price > self.limit:
            return self.limit, True
        return price, False

    def propose(self, own: float, other: float, rnd: int, default: float) -> tuple[float, bool, str]:
        raw = self.proposer(self.side, own, other, rnd) if self.proposer else None
        price = _round_price(raw if raw is not None else default)
        clamped, guard = self.clamp(price)
        # The note never states the limit itself, so it can be shown without leaking it.
        note = ""
        if guard:
            what = "floor" if self.side == "seller" else "budget cap"
            note = f"Wanted ₹{price:,.0f}; held at the {self.side}'s private {what}"
        return clamped, guard, note


@dataclass(kw_only=True)
class SellerBrain(_Brain):
    """The seller's strategy. Knows the floor; never reveals it."""

    side: Side = "seller"
    list_price: float = 0.0
    ask: float = 0.0

    def open(self, rnd: int) -> Move:
        self.ask, g, n = self.propose(0, 0, rnd, max(self.list_price, self.limit * 1.15))
        return Move("offer", self.ask, g, n)

    def respond(self, bid: float, buyer_stuck: bool, rnd: int) -> Move:
        # A buyer who has stopped moving has made a final offer: take it if it clears the floor.
        if buyer_stuck and bid >= self.limit:
            return Move("accept", bid)
        new_ask, g, n = self.propose(self.ask, bid, rnd, self.ask - self.concession * (self.ask - bid))
        if (new_ask <= bid or (new_ask - bid) <= self.tolerance * self.ask) and bid >= self.limit:
            return Move("accept", bid, g, n)
        stuck = new_ask >= self.ask
        self.ask = max(new_ask, self.limit)
        return Move("final" if g or self.ask == self.limit else "counter", self.ask, g, n, stuck)


@dataclass(kw_only=True)
class BuyerBrain(_Brain):
    """The buyer's strategy. Knows the budget cap; never reveals it."""

    side: Side = "buyer"
    bid: float = 0.0

    def respond_to_opening(self, ask: float, rnd: int) -> Move:
        self.bid, g, n = self.propose(0, ask, rnd, min(self.limit, ask * 0.6))
        if self.bid >= ask:
            return Move("accept", ask, g, n)
        return Move("offer", self.bid, g, n)

    def respond(self, ask: float, seller_stuck: bool, rnd: int) -> Move:
        new_bid, g, n = self.propose(self.bid, ask, rnd, self.bid + self.concession * (ask - self.bid))
        if (new_bid >= ask or (ask - new_bid) <= self.tolerance * ask) and ask <= self.limit:
            return Move("accept", ask, g, n)
        stuck = new_bid <= self.bid
        self.bid = min(new_bid, self.limit)
        if seller_stuck and stuck:
            return Move("decline", self.bid)  # neither side can move: the private limits don't overlap
        return Move("final" if g or self.bid == self.limit else "counter", self.bid, g, n, stuck)


async def speak(
    voice: Voice, side: Side, move: Move, item_summary: str, own_lang: str, other_lang: str, rnd: int
) -> NegotiationTurn:
    """Word a move in English and in the other party's language (or one's own, if theirs is English)."""
    local_lang = other_lang if other_lang != "en" else own_lang
    msg = await voice.negotiation_message(side, move.action, move.price, item_summary, local_lang)
    messages = {"en": msg["en"]}
    if local_lang != "en":
        messages[local_lang] = msg["local"]
    return NegotiationTurn(
        round=rnd, speaker=side, action=move.action, price_inr=move.price, messages=messages,
        guardrail_applied=move.guard, guardrail_note=move.note,
    )


class SellerPort(Protocol):
    """How the buyer side reaches the seller agent (in-process or over A2A)."""

    async def open(self, rnd: int) -> tuple[NegotiationTurn, bool]: ...
    async def respond(self, bid: float, buyer_stuck: bool, rnd: int) -> tuple[NegotiationTurn, bool]: ...


@dataclass
class LocalSeller:
    brain: SellerBrain
    voice: Voice
    item_summary: str
    seller_lang: str
    buyer_lang: str

    async def open(self, rnd: int) -> tuple[NegotiationTurn, bool]:
        m = self.brain.open(rnd)
        return await speak(self.voice, "seller", m, self.item_summary, self.seller_lang, self.buyer_lang, rnd), m.stuck

    async def respond(self, bid: float, buyer_stuck: bool, rnd: int) -> tuple[NegotiationTurn, bool]:
        m = self.brain.respond(bid, buyer_stuck, rnd)
        return await speak(self.voice, "seller", m, self.item_summary, self.seller_lang, self.buyer_lang, rnd), m.stuck


async def negotiate(
    seller: SellerPort,
    buyer: BuyerBrain,
    voice: Voice,
    item_summary: str,
    seller_lang: str,
    buyer_lang: str,
    max_rounds: int = 12,
    on_turn: Optional[Callable[[NegotiationTurn], Awaitable[None]]] = None,
) -> NegotiationResult:
    """Alternate turns between the seller agent and the buyer agent until one accepts or both stop."""
    transcript: list[NegotiationTurn] = []

    async def record(turn: NegotiationTurn) -> None:
        transcript.append(turn)
        if on_turn:
            await on_turn(turn)

    async def buyer_says(m: Move, rnd: int) -> None:
        await record(await speak(voice, "buyer", m, item_summary, buyer_lang, seller_lang, rnd))

    rnd = 1
    turn, seller_stuck = await seller.open(rnd)
    await record(turn)
    ask = turn.price_inr

    rnd += 1
    m = buyer.respond_to_opening(ask, rnd)
    await buyer_says(m, rnd)
    if m.action == "accept":
        return NegotiationResult("agreed", ask, transcript)
    bid, buyer_stuck = m.price, False

    while rnd < max_rounds:
        rnd += 1
        turn, seller_stuck = await seller.respond(bid, buyer_stuck, rnd)
        await record(turn)
        if turn.action == "accept":
            return NegotiationResult("agreed", turn.price_inr, transcript)
        ask = turn.price_inr

        rnd += 1
        m = buyer.respond(ask, seller_stuck, rnd)
        await buyer_says(m, rnd)
        if m.action == "accept":
            return NegotiationResult("agreed", ask, transcript)
        if m.action == "decline":
            return NegotiationResult("no_deal", None, transcript)
        bid, buyer_stuck = m.price, m.stuck

    await buyer_says(Move("decline", bid), rnd + 1)
    return NegotiationResult("no_deal", None, transcript)


async def run_negotiation(
    setup: NegotiationSetup,
    voice: Voice,
    on_turn: Optional[Callable[[NegotiationTurn], Awaitable[None]]] = None,
    proposer: Optional[Proposer] = None,
) -> NegotiationResult:
    """Both agents in-process (tests, and the fallback when A2A is off)."""
    seller = LocalSeller(
        SellerBrain(limit=setup.seller_floor, list_price=setup.list_price, concession=setup.concession,
                    tolerance=setup.tolerance, proposer=proposer),
        voice, setup.item_summary, setup.seller_lang, setup.buyer_lang,
    )
    buyer = BuyerBrain(limit=setup.buyer_cap, concession=setup.concession, tolerance=setup.tolerance, proposer=proposer)
    return await negotiate(seller, buyer, voice, setup.item_summary, setup.seller_lang, setup.buyer_lang,
                           setup.max_rounds, on_turn)


def clamp(side: Side, price: float, setup: NegotiationSetup) -> tuple[float, bool]:
    """Enforce a side's private limit. Returns (price, guardrail_applied)."""
    limit = setup.seller_floor if side == "seller" else setup.buyer_cap
    return _Brain(side=side, limit=limit).clamp(price)


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


__all__ = [
    "BuyerBrain", "LocalSeller", "Move", "NegotiationResult", "NegotiationSetup", "SellerBrain", "SellerPort",
    "clamp", "negotiate", "run_negotiation", "sandbox_settlement", "speak",
]
