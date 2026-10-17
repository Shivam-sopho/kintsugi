from __future__ import annotations

import threading
from typing import Optional

from ..models import AgentEvent, Bundle, Deal, Item, Job, LedgerEntry, Participant, Prediction, Site, StandingRequest
from ..vectors import cosine


class MemoryStore:
    """Process-local store. Data is lost on restart; seeded with demo data at startup."""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self.reset()

    def reset(self) -> None:
        with self._lock:
            self.participants: dict[str, Participant] = {}
            self.sites: dict[str, Site] = {}
            self.items: dict[str, Item] = {}
            self.predictions: dict[str, Prediction] = {}
            self.deals: dict[str, Deal] = {}
            self.bundles: dict[str, Bundle] = {}
            self.ledger: list[LedgerEntry] = []
            self.requests: dict[str, StandingRequest] = {}
            self.jobs: dict[str, Job] = {}
            self.events: dict[str, list[AgentEvent]] = {}

    def delete_docs(self, collection: str, ids: list[str]) -> None:
        """Remove some records (judge mode clears only its own sample data)."""
        drop = set(ids)
        with self._lock:
            if collection == "ledger":
                self.ledger = [e for e in self.ledger if e.id not in drop]
                return
            table = getattr(self, collection)
            for i in drop:
                table.pop(i, None)

    # participants
    def list_participants(self) -> list[Participant]:
        return list(self.participants.values())

    def get_participant(self, pid: str) -> Optional[Participant]:
        return self.participants.get(pid)

    def upsert_participant(self, p: Participant) -> None:
        with self._lock:
            self.participants[p.id] = p

    # sites
    def upsert_site(self, s: Site) -> None:
        with self._lock:
            self.sites[s.id] = s

    def get_site(self, sid: str) -> Optional[Site]:
        return self.sites.get(sid)

    def list_sites(self) -> list[Site]:
        return list(self.sites.values())

    # items
    def upsert_items(self, items: list[Item]) -> None:
        with self._lock:
            for it in items:
                self.items[it.id] = it

    def get_item(self, iid: str) -> Optional[Item]:
        return self.items.get(iid)

    def list_items(self, site_id: Optional[str] = None) -> list[Item]:
        return [i for i in self.items.values() if site_id is None or i.site_id == site_id]

    def nearest_items(self, vector: list[float], limit: int = 10) -> list[tuple[Item, float]]:
        scored = [(i, cosine(vector, i.embedding)) for i in self.items.values() if i.embedding]
        scored.sort(key=lambda t: t[1], reverse=True)
        return scored[:limit]

    # predictions
    def upsert_predictions(self, preds: list[Prediction]) -> None:
        with self._lock:
            for p in preds:
                self.predictions[p.id] = p

    def list_predictions(self) -> list[Prediction]:
        return list(self.predictions.values())

    # deals and bundles
    def upsert_deal(self, d: Deal) -> None:
        with self._lock:
            self.deals[d.id] = d

    def get_deal(self, did: str) -> Optional[Deal]:
        return self.deals.get(did)

    def list_deals(self) -> list[Deal]:
        return list(self.deals.values())

    def upsert_bundle(self, b: Bundle) -> None:
        with self._lock:
            self.bundles[b.id] = b

    def list_bundles(self) -> list[Bundle]:
        return list(self.bundles.values())

    # ledger
    # standing requests
    def upsert_request(self, r: StandingRequest) -> None:
        with self._lock:
            self.requests[r.id] = r

    def list_requests(self) -> list[StandingRequest]:
        return list(self.requests.values())

    def add_ledger(self, entries: list[LedgerEntry]) -> None:
        with self._lock:
            self.ledger.extend(entries)

    def list_ledger(self) -> list[LedgerEntry]:
        return list(self.ledger)

    # jobs and events
    def upsert_job(self, j: Job) -> None:
        with self._lock:
            self.jobs[j.id] = j

    def get_job(self, jid: str) -> Optional[Job]:
        return self.jobs.get(jid)

    def add_event(self, e: AgentEvent) -> None:
        with self._lock:
            self.events.setdefault(e.job_id, []).append(e)

    def list_events(self, job_id: str, after_ts: float = 0.0) -> list[AgentEvent]:
        return [e for e in self.events.get(job_id, []) if e.ts > after_ts]
