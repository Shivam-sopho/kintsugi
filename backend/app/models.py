"""Domain models shared by the agents, the store and the API."""

from __future__ import annotations

import time
import uuid
from enum import Enum
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:10]}"


class Rung(str, Enum):
    """The next-life ladder, from most to least valuable."""

    REUSE = "reuse"
    REPAIR = "repair"
    UPCYCLE = "upcycle"
    HARVEST_PARTS = "harvest_parts"
    RECYCLE = "recycle"
    RECOVER_ENERGY = "recover_energy"
    SAFE_DISPOSAL = "safe_disposal"


LADDER_ORDER: list[Rung] = list(Rung)

Condition = Literal["A", "B", "C", "D"]
Role = Literal[
    "homeowner",
    "contractor",
    "dealer",
    "repairer",
    "upcycler",
    "recycler",
    "energy_facility",
    "hazard_handler",
    "buyer",
    "ngo",
]


class GeoPoint(BaseModel):
    lat: float
    lng: float


class Component(BaseModel):
    name: str
    material: str
    est_weight_kg: float = 0.0
    next_life: Optional[Rung] = None
    destination_id: Optional[str] = None
    reason: str = ""


class Item(BaseModel):
    id: str = Field(default_factory=lambda: new_id("itm"))
    site_id: str
    type: str
    description: str = ""
    count: int = 1
    condition: Condition = "C"
    condition_reason: str = ""
    confidence: float = 0.5
    dimensions_cm: Optional[dict[str, float]] = None
    timestamps_s: list[float] = Field(default_factory=list)
    components: list[Component] = Field(default_factory=list)
    hazards: list[str] = Field(default_factory=list)
    needs_verification: bool = False
    tap_test: Optional[Literal["solid", "hollow", "unknown"]] = None
    location: GeoPoint
    language: str = "en"

    # Filled by the ladder, valuation and ledger steps
    next_life: Optional[Rung] = None
    next_life_reason: str = ""
    destination_id: Optional[str] = None
    value_min_inr: Optional[float] = None
    value_max_inr: Optional[float] = None
    price_sources: list[str] = Field(default_factory=list)
    repair_cost_inr: Optional[float] = None
    co2_avoided_kg: Optional[float] = None
    recovered_fraction: Optional[float] = None
    status: Literal["available", "in_deal", "sold", "routed"] = "available"
    seller_id: Optional[str] = None
    synthetic: bool = False

    # Human in the loop and seller settings
    verified: bool = False  # a person confirmed (or corrected) what Scout saw
    floor_price_inr: Optional[float] = None  # seller's private lowest price for the lot; never sent to buyers
    # Evidence and guidance
    media_index: Optional[int] = None  # which uploaded file the item was seen in
    evidence: list[str] = Field(default_factory=list)  # evidence image ids (faces blurred)
    take_apart: dict[str, list[str]] = Field(default_factory=dict)  # language code -> steps

    # Never sent to the browser
    embedding: Optional[list[float]] = Field(default=None, exclude=True)

    @property
    def total_weight_kg(self) -> float:
        return sum(c.est_weight_kg for c in self.components) * max(self.count, 1)


class Site(BaseModel):
    id: str = Field(default_factory=lambda: new_id("site"))
    owner_id: str
    kind: Literal["home", "building"]
    name: str
    address: str = ""
    location: GeoPoint
    media_uris: list[str] = Field(default_factory=list)
    created_at: float = Field(default_factory=time.time)


class Participant(BaseModel):
    id: str = Field(default_factory=lambda: new_id("ppl"))
    name: str
    role: Role
    language: str = "en"
    location: GeoPoint
    accepts_types: list[str] = Field(default_factory=list)  # item types wanted as-is
    accepts_materials: list[str] = Field(default_factory=list)  # materials wanted
    min_bundle_value_inr: float = 0.0  # dealers only collect above this
    floor_price_inr: Optional[float] = None  # private to the seller agent
    budget_cap_inr: Optional[float] = None  # private to the buyer agent
    synthetic: bool = True
    place_id: Optional[str] = None


class Prediction(BaseModel):
    id: str = Field(default_factory=lambda: new_id("prd"))
    kind: Literal["supply", "demand"]
    title: str
    address: str = ""
    location: GeoPoint
    expected_date: str = ""
    expected_materials: list[str] = Field(default_factory=list)
    confidence: float = 0.5
    source_language: str = "en"
    source_excerpt: str = ""
    synthetic: bool = True


class NegotiationTurn(BaseModel):
    round: int
    speaker: Literal["seller", "buyer"]
    action: Literal["offer", "counter", "final", "accept", "decline"]
    price_inr: float
    # The same message in each party's language, e.g. {"en": "...", "hi": "..."}
    messages: dict[str, str]
    guardrail_applied: bool = False
    guardrail_note: str = ""


class Settlement(BaseModel):
    """Sandbox settlement shaped after AP2's intent, cart and payment mandates.

    No money moves. Replace with a real AP2 integration (test credentials) when ready.
    """

    label: str = "SANDBOX: no real money moved"
    intent_mandate: dict[str, Any]
    cart_mandate: dict[str, Any]
    payment_mandate: dict[str, Any]
    settled_at: float = Field(default_factory=time.time)


class Deal(BaseModel):
    id: str = Field(default_factory=lambda: new_id("deal"))
    item_ids: list[str]
    seller_id: str
    buyer_id: str
    status: Literal["negotiating", "agreed", "no_deal", "approved", "settled"] = "negotiating"
    transcript: list[NegotiationTurn] = Field(default_factory=list)
    final_price_inr: Optional[float] = None
    settlement: Optional[Settlement] = None
    created_at: float = Field(default_factory=time.time)


class Bundle(BaseModel):
    id: str = Field(default_factory=lambda: new_id("bdl"))
    dealer_id: str
    item_ids: list[str]
    route: list[str]  # ordered site ids, starting from the dealer
    total_value_inr: float
    total_weight_kg: float
    status: Literal["proposed", "accepted"] = "proposed"


class LedgerEntry(BaseModel):
    id: str = Field(default_factory=lambda: new_id("led"))
    source_id: str  # deal id or routing/bundle id
    item_id: str
    material: str
    rung: Rung
    mass_kg: float
    co2_avoided_kg: float
    value_inr: float = 0.0
    factor_kg_per_kg: float
    factor_source: str
    created_at: float = Field(default_factory=time.time)


class AgentEvent(BaseModel):
    job_id: str
    agent: Literal["system", "oracle", "scout", "architect", "seller", "buyer", "bundler", "market", "ledger"]
    step: str
    message: str
    data: dict[str, Any] = Field(default_factory=dict)
    ts: float = Field(default_factory=time.time)


class Job(BaseModel):
    id: str = Field(default_factory=lambda: new_id("job"))
    kind: str
    status: Literal["queued", "running", "done", "error"] = "queued"
    result: dict[str, Any] = Field(default_factory=dict)
    error: Optional[str] = None
    skip: bool = False  # set by the UI to fast-forward judge mode
    created_at: float = Field(default_factory=time.time)
