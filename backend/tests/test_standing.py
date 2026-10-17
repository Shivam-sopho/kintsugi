"""Accounts earn a circular standing from settled hand-overs and sales, certified as a PDF."""

from app import agents
from app.models import GeoPoint, Item, Rung

from .test_features import client, scan, wait  # noqa: F401  (pytest fixture and helpers)


def test_a_first_handover_earns_a_standing_and_a_certificate(client):
    before = client.get("/api/people/ppl_me/standing").json()
    assert before["level"] is None and before["next"]["name"] == "Circular starter"
    assert client.get("/api/people/ppl_me/certificate.pdf").status_code == 404

    it = next(i for i in scan(client, kind="home", seller_id="ppl_me") if i["destination_id"] or i["components"][0]["destination_id"])
    wait(client, client.post(f"/api/items/{it['id']}/handover").json()["id"])
    after = client.get("/api/people/ppl_me/standing").json()
    assert after["level"] == "Circular starter" and after["handovers"] == 1 and after["gave"]["kg"] > 0
    r = client.get("/api/people/ppl_me/certificate.pdf")
    assert r.status_code == 200 and r.content.startswith(b"%PDF")
    assert client.get("/api/people/nobody/standing").status_code == 404


def test_possible_next_lives_are_kept_honest_by_code():
    it = Item(site_id="s", type="chair", description="", next_life=Rung.HARVEST_PARTS, next_life_reason="Repair costs more",
              location=GeoPoint(lat=12.9, lng=77.6))
    ideas = agents.check_afterlives([
        {"use": "Melt it", "next_life": "recycle", "how": "x"},
        {"use": "Make it a throne", "next_life": "teleport", "how": "x"},
        {"use": "A family uses it", "next_life": "reuse", "how": "x"},
    ], it)
    assert [i["next_life"] for i in ideas] == ["harvest_parts", "reuse", "recycle"]
    assert ideas[0]["best"] and not ideas[1]["best"]

    it.hazards = ["suspected asbestos"]
    it.next_life = Rung.SAFE_DISPOSAL
    ideas = agents.check_afterlives([{"use": "Reuse it", "next_life": "reuse", "how": "x"}], it)
    assert [i["next_life"] for i in ideas] == ["safe_disposal"]
