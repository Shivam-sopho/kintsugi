"""Firestore-backed store for Cloud Run.

Written against google-cloud-firestore 2.x but not yet run against a live database.
Vector search needs a vector index on items.embedding (see infra/firestore.indexes.json).
"""

from __future__ import annotations

from typing import Optional, TypeVar

from google.cloud import firestore
from google.cloud.firestore_v1.base_vector_query import DistanceMeasure
from google.cloud.firestore_v1.vector import Vector
from pydantic import BaseModel

from ..config import Settings
from ..models import AgentEvent, Bundle, Deal, Item, Job, LedgerEntry, Participant, Prediction, Site, StandingRequest

T = TypeVar("T", bound=BaseModel)

COLLECTIONS = ["participants", "sites", "items", "predictions", "deals", "bundles", "requests", "ledger", "jobs", "events"]


class FirestoreStore:
    def __init__(self, settings: Settings):
        self.db = firestore.Client(project=settings.gcp_project or None, database=settings.firestore_database)

    # helpers
    def _put(self, col: str, doc_id: str, model: BaseModel, extra: Optional[dict] = None) -> None:
        data = model.model_dump(mode="json")
        if extra:
            data.update(extra)
        self.db.collection(col).document(doc_id).set(data)

    def _get(self, col: str, doc_id: str, cls: type[T]) -> Optional[T]:
        snap = self.db.collection(col).document(doc_id).get()
        return cls.model_validate(snap.to_dict()) if snap.exists else None

    def _all(self, col: str, cls: type[T]) -> list[T]:
        return [cls.model_validate(s.to_dict()) for s in self.db.collection(col).stream()]

    def reset(self) -> None:
        for col in COLLECTIONS:
            for snap in self.db.collection(col).limit(500).stream():
                snap.reference.delete()

    def delete_docs(self, collection: str, ids: list[str]) -> None:
        """Remove some records (judge mode clears only its own sample data)."""
        for i in ids:
            self.db.collection(collection).document(i).delete()

    # participants
    def list_participants(self) -> list[Participant]:
        return self._all("participants", Participant)

    def get_participant(self, pid: str) -> Optional[Participant]:
        return self._get("participants", pid, Participant)

    def upsert_participant(self, p: Participant) -> None:
        self._put("participants", p.id, p)

    # sites
    def upsert_site(self, s: Site) -> None:
        self._put("sites", s.id, s)

    def get_site(self, sid: str) -> Optional[Site]:
        return self._get("sites", sid, Site)

    def list_sites(self) -> list[Site]:
        return self._all("sites", Site)

    # items
    @staticmethod
    def _item_from(data: dict) -> Item:
        emb = data.pop("embedding", None)
        item = Item.model_validate(data)
        if emb is not None:
            item.embedding = list(emb)
        return item

    def upsert_items(self, items: list[Item]) -> None:
        batch = self.db.batch()
        for it in items:
            data = it.model_dump(mode="json")
            if it.embedding:
                data["embedding"] = Vector(it.embedding)
            batch.set(self.db.collection("items").document(it.id), data)
        batch.commit()

    def get_item(self, iid: str) -> Optional[Item]:
        snap = self.db.collection("items").document(iid).get()
        return self._item_from(snap.to_dict()) if snap.exists else None

    def list_items(self, site_id: Optional[str] = None) -> list[Item]:
        q = self.db.collection("items")
        if site_id:
            q = q.where(filter=firestore.FieldFilter("site_id", "==", site_id))
        return [self._item_from(s.to_dict()) for s in q.stream()]

    def nearest_items(self, vector: list[float], limit: int = 10) -> list[tuple[Item, float]]:
        q = self.db.collection("items").find_nearest(
            vector_field="embedding",
            query_vector=Vector(vector),
            distance_measure=DistanceMeasure.COSINE,
            limit=limit,
            distance_result_field="_distance",
        )
        out = []
        for snap in q.stream():
            data = snap.to_dict()
            dist = float(data.pop("_distance", 1.0))
            out.append((self._item_from(data), 1.0 - dist))  # cosine distance -> similarity
        return out

    # predictions
    def upsert_predictions(self, preds: list[Prediction]) -> None:
        for p in preds:
            self._put("predictions", p.id, p)

    def list_predictions(self) -> list[Prediction]:
        return self._all("predictions", Prediction)

    # deals and bundles
    def upsert_deal(self, d: Deal) -> None:
        self._put("deals", d.id, d)

    def get_deal(self, did: str) -> Optional[Deal]:
        return self._get("deals", did, Deal)

    def list_deals(self) -> list[Deal]:
        return self._all("deals", Deal)

    def upsert_bundle(self, b: Bundle) -> None:
        self._put("bundles", b.id, b)

    def list_bundles(self) -> list[Bundle]:
        return self._all("bundles", Bundle)

    # ledger
    # standing requests (their embedding is a plain list: matched in Python, not by the vector index)
    def upsert_request(self, r: StandingRequest) -> None:
        self._put("requests", r.id, r)

    def list_requests(self) -> list[StandingRequest]:
        return self._all("requests", StandingRequest)

    def add_ledger(self, entries: list[LedgerEntry]) -> None:
        batch = self.db.batch()
        for e in entries:
            batch.set(self.db.collection("ledger").document(e.id), e.model_dump(mode="json"))
        batch.commit()

    def list_ledger(self) -> list[LedgerEntry]:
        return self._all("ledger", LedgerEntry)

    # jobs and events
    def upsert_job(self, j: Job) -> None:
        self._put("jobs", j.id, j)

    def get_job(self, jid: str) -> Optional[Job]:
        return self._get("jobs", jid, Job)

    def add_event(self, e: AgentEvent) -> None:
        self.db.collection("events").add(e.model_dump(mode="json"))

    def list_events(self, job_id: str, after_ts: float = 0.0) -> list[AgentEvent]:
        q = (
            self.db.collection("events")
            .where(filter=firestore.FieldFilter("job_id", "==", job_id))
            .where(filter=firestore.FieldFilter("ts", ">", after_ts))
            .order_by("ts")
        )
        return [AgentEvent.model_validate(s.to_dict()) for s in q.stream()]
