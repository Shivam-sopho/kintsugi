"""The seller agent as an A2A service (Agent2Agent protocol, a2a-sdk).

The seller's private floor lives only here. The buyer side (the market flow) discovers this
agent through its Agent Card and sends it the buyer's moves as A2A messages with JSON data parts;
the seller agent answers with its own move, already worded in both languages.

Endpoints, mounted on the API:
    GET  /a2a/seller/.well-known/agent-card.json
    POST /a2a/seller            (A2A JSON-RPC)

By default the buyer side calls this agent in-process (an ASGI transport, no network hop). To run
the seller agent as its own Cloud Run service, deploy the API twice and set A2A_SELLER_URL on the
buyer side to the seller service's base URL.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

import httpx
from a2a.client.client import ClientConfig
from a2a.client.client_factory import create_client
from a2a.helpers.proto_helpers import get_data_parts, new_data_message
from a2a.server.agent_execution import AgentExecutor, RequestContext
from a2a.server.events import EventQueue
from a2a.server.request_handlers import DefaultRequestHandlerV2
from a2a.server.routes.agent_card_routes import create_agent_card_routes
from a2a.server.routes.fastapi_routes import add_a2a_routes_to_fastapi
from a2a.server.routes.jsonrpc_routes import create_jsonrpc_routes
from a2a.server.tasks import InMemoryTaskStore
from a2a.types import AgentCapabilities, AgentCard, AgentInterface, AgentSkill, Role, SendMessageRequest
from google.protobuf.json_format import MessageToDict

from .config import Settings, get_settings
from .llm import get_llm
from .models import Item, NegotiationTurn, Participant
from .negotiation import Move, SellerBrain, speak
from .store import get_store

log = logging.getLogger(__name__)

SELLER_PATH = "/a2a/seller"
CARD_PATH = f"{SELLER_PATH}/.well-known/agent-card.json"
IN_PROCESS_BASE = "http://kintsugi.internal"


def lot_summary(items: list[Item]) -> str:
    return ", ".join(f"{i.count} {i.type}{'s' if i.count > 1 and not i.type.endswith('s') else ''}" for i in items)


def seller_terms(items: list[Item], seller: Optional[Participant]) -> tuple[float, float]:
    """(list price, private floor) for a lot. The floor is what the seller set, else 90% of the low estimate."""
    list_price = sum((i.value_max_inr or 0) * i.count for i in items)
    if items and all(i.floor_price_inr for i in items):
        floor = sum(i.floor_price_inr or 0 for i in items)
    elif seller and seller.floor_price_inr:
        floor = seller.floor_price_inr
    else:
        floor = round(sum((i.value_min_inr or 0) * i.count for i in items) * 0.9, -1)
    return list_price, floor


def agent_card(settings: Settings) -> AgentCard:
    base = (settings.public_base_url or IN_PROCESS_BASE).rstrip("/")
    return AgentCard(
        name="Kintsugi seller agent",
        description="Represents a seller of reclaimed materials. Negotiates within the seller's private floor "
        "and words every move in English and the counterpart's language.",
        version="0.1.0",
        supported_interfaces=[AgentInterface(url=f"{base}{SELLER_PATH}", protocol_binding="JSONRPC", protocol_version="1.0")],
        capabilities=AgentCapabilities(streaming=False),
        default_input_modes=["application/json"],
        default_output_modes=["application/json"],
        skills=[
            AgentSkill(
                id="negotiate_lot",
                name="Negotiate a lot",
                description='Data part {"op": "open"|"respond", "deal_id", "buyer_lang", "bid", "buyer_stuck", "round"}. '
                'Replies with {"turn": <negotiation turn>, "stuck": bool}.',
                tags=["circular-economy", "negotiation", "multilingual"],
                examples=['{"op": "open", "deal_id": "deal_123", "buyer_lang": "en", "round": 1}'],
            )
        ],
    )


class SellerAgentExecutor(AgentExecutor):
    """Holds one SellerBrain per deal. The floor is loaded from the seller's own records here."""

    def __init__(self) -> None:
        self.sessions: dict[str, tuple[SellerBrain, str, str, str]] = {}  # deal -> (brain, summary, s_lang, b_lang)

    async def _turn(self, move: Move, deal_id: str, rnd: int) -> dict[str, Any]:
        brain, summary, s_lang, b_lang = self.sessions[deal_id]
        turn = await speak(get_llm(), "seller", move, summary, s_lang, b_lang, rnd)
        return {"turn": turn.model_dump(mode="json"), "stuck": move.stuck}

    async def execute(self, context: RequestContext, event_queue: EventQueue) -> None:
        req = (get_data_parts(context.message.parts) or [{}])[0]
        deal_id, rnd = str(req.get("deal_id", "")), int(req.get("round", 1))
        try:
            if req.get("op") == "open":
                store = get_store()
                deal = store.get_deal(deal_id)
                if deal is None:
                    raise ValueError("unknown deal")
                items = [i for i in (store.get_item(x) for x in deal.item_ids) if i]
                seller = store.get_participant(deal.seller_id)
                list_price, floor = seller_terms(items, seller)
                brain = SellerBrain(limit=floor, list_price=list_price)
                self.sessions[deal_id] = (brain, lot_summary(items), seller.language if seller else "en",
                                          str(req.get("buyer_lang", "en")))
                reply = await self._turn(brain.open(rnd), deal_id, rnd)
            elif req.get("op") == "respond" and deal_id in self.sessions:
                brain = self.sessions[deal_id][0]
                move = brain.respond(float(req["bid"]), bool(req.get("buyer_stuck")), rnd)
                reply = await self._turn(move, deal_id, rnd)
                if move.action in ("accept", "decline"):
                    self.sessions.pop(deal_id, None)
            else:
                raise ValueError("expected op 'open' or 'respond' for a known deal")
        except Exception as exc:  # report the problem to the caller as data
            log.warning("Seller agent error: %s", exc)
            reply = {"error": str(exc)}
        await event_queue.enqueue_event(new_data_message(reply, role=Role.ROLE_AGENT))

    async def cancel(self, context: RequestContext, event_queue: EventQueue) -> None:
        return None


_executor = SellerAgentExecutor()


def mount_seller_agent(app) -> None:
    settings = get_settings()
    card = agent_card(settings)
    handler = DefaultRequestHandlerV2(agent_executor=_executor, task_store=InMemoryTaskStore(), agent_card=card)
    add_a2a_routes_to_fastapi(
        app,
        agent_card_routes=create_agent_card_routes(card, card_url=CARD_PATH),
        jsonrpc_routes=create_jsonrpc_routes(handler, rpc_url=SELLER_PATH),
    )


class A2ASeller:
    """The buyer side's handle on the seller agent, over A2A."""

    def __init__(self, deal_id: str, buyer_lang: str, settings: Settings):
        self.deal_id, self.buyer_lang, self.settings = deal_id, buyer_lang, settings
        self._client = None
        self.card_name = ""

    async def _connect(self):
        if self._client is None:
            if self.settings.a2a_seller_url:
                base = self.settings.a2a_seller_url.rstrip("/")
                http = httpx.AsyncClient(timeout=60)
            else:
                from .main import app  # in-process: same API, no network hop

                base = IN_PROCESS_BASE
                http = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url=base, timeout=60)
            self._client = await create_client(
                f"{base}{SELLER_PATH}",
                client_config=ClientConfig(httpx_client=http, streaming=False),
                relative_card_path=".well-known/agent-card.json",
            )
            self.card_name = "Kintsugi seller agent"
        return self._client

    async def _send(self, payload: dict[str, Any]) -> tuple[NegotiationTurn, bool]:
        client = await self._connect()
        msg = new_data_message(payload, role=Role.ROLE_USER)
        async for event in client.send_message(SendMessageRequest(message=msg)):
            data = MessageToDict(event, preserving_proto_field_name=True)
            parts = data.get("message", {}).get("parts", [])
            for p in parts:
                reply = p.get("data")
                if reply is None:
                    continue
                if "error" in reply:
                    raise RuntimeError(f"Seller agent: {reply['error']}")
                turn = reply["turn"]
                turn["round"] = int(turn["round"])
                return NegotiationTurn.model_validate(turn), bool(reply.get("stuck"))
        raise RuntimeError("Seller agent sent no reply")

    async def open(self, rnd: int) -> tuple[NegotiationTurn, bool]:
        return await self._send({"op": "open", "deal_id": self.deal_id, "buyer_lang": self.buyer_lang, "round": rnd})

    async def respond(self, bid: float, buyer_stuck: bool, rnd: int) -> tuple[NegotiationTurn, bool]:
        return await self._send({"op": "respond", "deal_id": self.deal_id, "bid": bid, "buyer_stuck": buyer_stuck, "round": rnd})
