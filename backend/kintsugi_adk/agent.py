"""Kintsugi as an ADK multi-agent app.

Run the conversational version with the ADK dev UI (live mode needs Vertex AI):
    cd backend
    export GOOGLE_GENAI_USE_VERTEXAI=TRUE GOOGLE_CLOUD_PROJECT=<project> GOOGLE_CLOUD_LOCATION=us-central1
    adk web
The tools call the same code as the REST API, so the map and Mission control update too.
"""

from __future__ import annotations

from typing import Any, Optional

from google.adk.agents import LlmAgent

from app import agents as flows
from app.config import get_settings
from app.llm import get_llm
from app.models import GeoPoint, new_id
from app.store import get_store

settings = get_settings()


async def find_reclaimed_materials(query: str, lat: Optional[float] = None, lng: Optional[float] = None) -> list[dict[str, Any]]:
    """Search reclaimed items on the map by description, in any language.

    Args:
        query: what the buyer wants, e.g. "teak doors" or "सागौन के दरवाज़े".
        lat: buyer latitude (optional).
        lng: buyer longitude (optional).
    """
    near = GeoPoint(lat=lat, lng=lng) if lat is not None and lng is not None else None
    results = await flows.search(get_store(), get_llm(), settings, query=query, near=near)
    return [
        {"item_id": r["item"]["id"], "type": r["item"]["type"], "count": r["item"]["count"],
         "condition": r["item"]["condition"], "value_min_inr": r["item"]["value_min_inr"],
         "value_max_inr": r["item"]["value_max_inr"], "distance_km": r["distance_km"], "score": r["score"]}
        for r in results
    ]


def get_item_passport(item_id: str) -> dict[str, Any]:
    """Return an item's passport: condition, components, next life, value and CO2 avoided.

    Args:
        item_id: the item id from a search result.
    """
    item = get_store().get_item(item_id)
    return item.model_dump(mode="json") if item else {"error": "not found"}


async def design_space(brief: str, budget_inr: float, lat: float, lng: float) -> dict[str, Any]:
    """Design a space using only nearby reclaimed items, within budget.

    Args:
        brief: what the buyer wants, e.g. "cozy café, 40 m², warm wood".
        budget_inr: total budget in rupees.
        lat: site latitude.
        lng: site longitude.
    """
    store = get_store()
    emit = flows.Emitter(store, new_id("job"))
    return await flows.architect_design(store, get_llm(), settings, emit, brief, budget_inr, GeoPoint(lat=lat, lng=lng))


async def negotiate(item_ids: list[str], buyer_id: str, budget_cap_inr: Optional[float] = None) -> dict[str, Any]:
    """Let the seller's agent and the buyer's agent negotiate. Limits are enforced in code.

    Args:
        item_ids: items from one seller.
        buyer_id: the buyer participant id.
        budget_cap_inr: the buyer's private maximum (optional).
    """
    store = get_store()
    deal = await flows.negotiate_deal(store, get_llm(), settings, flows.Emitter(store, new_id("job")),
                                      item_ids, buyer_id, budget_cap_inr)
    return {"deal_id": deal.id, "status": deal.status, "final_price_inr": deal.final_price_inr,
            "transcript": [t.model_dump(mode="json") for t in deal.transcript]}


def city_impact() -> dict[str, Any]:
    """Totals from the impact ledger: kg diverted, CO2 avoided, value recovered."""
    return flows.ledger_summary(get_store())


architect_agent = LlmAgent(
    name="architect",
    model=settings.model_reasoning,
    description="Finds reclaimed materials on the map and designs spaces from them.",
    instruction="Help buyers find reclaimed materials and design with them. Only propose items returned by your tools.",
    tools=[find_reclaimed_materials, get_item_passport, design_space],
)

market_agent = LlmAgent(
    name="market",
    model=settings.model_reasoning,
    description="Runs negotiations between a seller's agent and a buyer's agent.",
    instruction="Start negotiations when asked. Never promise a price; report the transcript and the outcome. "
    "Payment always needs the buyer's explicit approval in the app.",
    tools=[negotiate],
)

ledger_agent = LlmAgent(
    name="ledger",
    model=settings.model_fast,
    description="Reports verified impact: kg diverted, CO2 avoided, money recovered.",
    instruction="Report impact numbers exactly as the tool returns them, with the emission-factor source.",
    tools=[city_impact, get_item_passport],
)

root_agent = LlmAgent(
    name="kintsugi",
    model=settings.model_reasoning,
    description="Kintsugi coordinator: finds the best next life for anything.",
    instruction=(
        "You are Kintsugi, Google Maps for the circular economy. Reply in the user's language. "
        "Delegate: material search and design → architect; deals → market; impact numbers → ledger."
    ),
    sub_agents=[architect_agent, market_agent, ledger_agent],
)
