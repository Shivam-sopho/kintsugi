"""Kintsugi API (FastAPI). Run: uvicorn app.main:app --reload --port 8080"""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Any, Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from . import agents, ledger
from .config import get_settings
from .demo import fixtures
from .llm import get_llm
from .media import to_media_ref
from .models import GeoPoint, Job, Site, new_id
from .store import get_store

log = logging.getLogger("kintsugi")
logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(_: FastAPI):
    store = get_store()
    if not store.list_participants():
        agents.seed_participants(store)
        store.upsert_predictions(fixtures.predictions())
    yield


app = FastAPI(title="Kintsugi API", version="0.1.0", lifespan=lifespan)
settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_methods=["*"],
    allow_headers=["*"],
)

_tasks: set[asyncio.Task] = set()


def _start_job(kind: str, coro_factory) -> Job:
    """Run an agent flow in the background; the client polls the job and its events."""
    store = get_store()
    job = Job(kind=kind, status="running")
    store.upsert_job(job)

    async def runner():
        try:
            result = await coro_factory(job.id)
            job.status, job.result = "done", result or {}
        except Exception as exc:  # surface the error to the UI instead of failing silently
            log.exception("Job %s failed", job.id)
            job.status, job.error = "error", str(exc)
        store.upsert_job(job)

    task = asyncio.create_task(runner())
    _tasks.add(task)
    task.add_done_callback(_tasks.discard)
    return job


# ------------------------------------------------------------------ read

@app.get("/api/health")
def health() -> dict[str, Any]:
    return {"ok": True, "mock_mode": settings.mock_mode, "store": settings.store}


@app.get("/api/state")
def state() -> dict[str, Any]:
    """Everything the map needs in one call."""
    store = get_store()
    return {
        "mock_mode": settings.mock_mode,
        "sites": [s.model_dump(mode="json") for s in store.list_sites()],
        "items": [i.model_dump(mode="json") for i in store.list_items()],
        "participants": [p.model_dump(mode="json", exclude={"floor_price_inr", "budget_cap_inr"})
                         for p in store.list_participants()],
        "predictions": [p.model_dump(mode="json") for p in store.list_predictions()],
        "deals": [d.model_dump(mode="json") for d in store.list_deals()],
        "bundles": [b.model_dump(mode="json") for b in store.list_bundles()],
        "totals": agents.ledger_summary(store),
    }


@app.get("/api/items/{item_id}")
def get_item(item_id: str) -> dict[str, Any]:
    it = get_store().get_item(item_id)
    if not it:
        raise HTTPException(404, "Item not found")
    return it.model_dump(mode="json")


@app.get("/api/jobs/{job_id}")
def get_job(job_id: str) -> dict[str, Any]:
    job = get_store().get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return job.model_dump(mode="json")


@app.get("/api/jobs/{job_id}/events")
def job_events(job_id: str, after: float = 0.0) -> list[dict[str, Any]]:
    return [e.model_dump(mode="json") for e in get_store().list_events(job_id, after)]


@app.get("/api/ledger")
def get_ledger() -> dict[str, Any]:
    store = get_store()
    return {"totals": agents.ledger_summary(store), "entries": [e.model_dump(mode="json") for e in store.list_ledger()]}


# ------------------------------------------------------------------ flows

@app.post("/api/scan")
async def scan(
    files: list[UploadFile] = File(...),
    kind: str = Form("home"),
    name: str = Form("My scan"),
    lat: float = Form(...),
    lng: float = Form(...),
    seller_id: str = Form("ppl_me"),
    narration_text: Optional[str] = Form(None),
) -> dict[str, Any]:
    media = [to_media_ref(f.filename or "upload", await f.read(), f.content_type, settings) for f in files]
    site = Site(owner_id=seller_id, kind="building" if kind == "building" else "home", name=name,
                location=GeoPoint(lat=lat, lng=lng))
    store, llm = get_store(), get_llm()

    async def flow(job_id: str):
        emit = agents.Emitter(store, job_id)
        items = await agents.scout_scan(store, llm, settings, emit, media, site, seller_id, narration_text)
        return {"site_id": site.id, "item_ids": [i.id for i in items]}

    return _start_job("scan", flow).model_dump(mode="json")


@app.post("/api/oracle")
async def oracle(file: UploadFile = File(...)) -> dict[str, Any]:
    doc = to_media_ref(file.filename or "notice.pdf", await file.read(), file.content_type, settings)
    store, llm = get_store(), get_llm()

    async def flow(job_id: str):
        preds = await agents.oracle_ingest(store, llm, settings, agents.Emitter(store, job_id), doc)
        return {"prediction_ids": [p.id for p in preds]}

    return _start_job("oracle", flow).model_dump(mode="json")


class SearchIn(BaseModel):
    query: str
    lat: Optional[float] = None
    lng: Optional[float] = None


@app.post("/api/search")
async def search(body: SearchIn) -> list[dict[str, Any]]:
    near = GeoPoint(lat=body.lat, lng=body.lng) if body.lat is not None and body.lng is not None else None
    return await agents.search(get_store(), get_llm(), settings, query=body.query, near=near)


@app.post("/api/search/image")
async def search_image(file: UploadFile = File(...), lat: Optional[float] = Form(None), lng: Optional[float] = Form(None)):
    near = GeoPoint(lat=lat, lng=lng) if lat is not None and lng is not None else None
    data = await file.read()
    return await agents.search(get_store(), get_llm(), settings, image=(data, file.content_type or "image/jpeg"), near=near)


class DesignIn(BaseModel):
    brief: str
    budget_inr: float
    lat: float
    lng: float


@app.post("/api/design")
async def design(body: DesignIn) -> dict[str, Any]:
    store, llm = get_store(), get_llm()

    async def flow(job_id: str):
        return await agents.architect_design(store, llm, settings, agents.Emitter(store, job_id),
                                             body.brief, body.budget_inr, GeoPoint(lat=body.lat, lng=body.lng))

    return _start_job("design", flow).model_dump(mode="json")


class DealIn(BaseModel):
    item_ids: list[str]
    buyer_id: str
    budget_cap_inr: Optional[float] = None


@app.post("/api/deals")
async def start_deal(body: DealIn) -> dict[str, Any]:
    store, llm = get_store(), get_llm()

    async def flow(job_id: str):
        deal = await agents.negotiate_deal(store, llm, settings, agents.Emitter(store, job_id, delay=0.4),
                                           body.item_ids, body.buyer_id, body.budget_cap_inr)
        return {"deal_id": deal.id, "status": deal.status}

    return _start_job("deal", flow).model_dump(mode="json")


@app.get("/api/deals/{deal_id}")
def get_deal(deal_id: str) -> dict[str, Any]:
    deal = get_store().get_deal(deal_id)
    if not deal:
        raise HTTPException(404, "Deal not found")
    return deal.model_dump(mode="json")


@app.post("/api/deals/{deal_id}/approve")
async def approve(deal_id: str) -> dict[str, Any]:
    store = get_store()
    try:
        deal = await agents.approve_deal(store, agents.Emitter(store, new_id("job")), deal_id)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return deal.model_dump(mode="json")


@app.post("/api/bundles/run")
async def bundles() -> dict[str, Any]:
    store = get_store()

    async def flow(job_id: str):
        bs = await agents.run_bundling(store, agents.Emitter(store, job_id))
        return {"bundle_ids": [b.id for b in bs]}

    return _start_job("bundling", flow).model_dump(mode="json")


@app.post("/api/judge-mode")
async def judge_mode() -> dict[str, Any]:
    store, llm = get_store(), get_llm()
    return _start_job("judge_mode", lambda job_id: agents.judge_mode(store, llm, settings, job_id)).model_dump(mode="json")


@app.get("/api/certificate/{deal_id}", response_class=HTMLResponse)
def certificate(deal_id: str) -> str:
    """A printable impact certificate for a settled deal (browser print → PDF)."""
    store = get_store()
    deal = store.get_deal(deal_id)
    if not deal or deal.status != "settled":
        raise HTTPException(404, "No settled deal")
    entries = [e for e in store.list_ledger() if e.source_id == deal_id]
    t = ledger.totals(entries)
    buyer, seller = store.get_participant(deal.buyer_id), store.get_participant(deal.seller_id)
    rows = "".join(
        f"<tr><td>{e.material}</td><td>{e.rung.value.replace('_', ' ')}</td><td>{e.mass_kg:,.1f}</td>"
        f"<td>{e.factor_kg_per_kg}</td><td>{e.co2_avoided_kg:,.1f}</td></tr>"
        for e in entries
    )
    return f"""<!doctype html><html><head><meta charset="utf-8"><title>Kintsugi impact certificate</title>
<style>body{{font-family:Georgia,serif;max-width:720px;margin:40px auto;color:#1d1d1b}}
h1{{font-weight:500}}table{{border-collapse:collapse;width:100%}}td,th{{border-bottom:1px solid #ccc;padding:6px;text-align:left}}
.big{{font-size:28px}}.note{{color:#666;font-size:13px}}</style></head><body>
<h1>Kintsugi impact certificate</h1>
<p>{seller.name if seller else deal.seller_id} → {buyer.name if buyer else deal.buyer_id} · deal {deal.id}</p>
<p class="big">{t['mass_diverted_kg']:,.0f} kg reused · {t['co2_avoided_kg']:,.0f} kg CO2e avoided</p>
<table><tr><th>Material</th><th>Next life</th><th>kg</th><th>kg CO2e/kg</th><th>kg CO2e avoided</th></tr>{rows}</table>
<p class="note">Emission factors: {t['factor_source']}. Settlement: {deal.settlement.label if deal.settlement else ''}.</p>
</body></html>"""
