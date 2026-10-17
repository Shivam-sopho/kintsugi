"""Downloadable PDFs: the impact report and the certificates, with no private limits in them."""

from .test_features import client, scan, wait  # noqa: F401  (pytest fixture and helpers)


def _settle_a_handover(client) -> str:
    it = next(i for i in scan(client, seller_id="ppl_me") if not i["hazards"] and i["destination_id"])
    client.patch(f"/api/items/{it['id']}", json={"floor_price_inr": 98765})
    job = wait(client, client.post(f"/api/items/{it['id']}/handover").json()["id"])
    return job["result"]["deal_id"]


def test_impact_report_downloads_as_a_pdf(client):
    _settle_a_handover(client)
    for url in ("/api/report.pdf", "/api/report.pdf?persona_id=ppl_me"):
        r = client.get(url)
        assert r.status_code == 200 and r.headers["content-type"] == "application/pdf"
        assert "attachment" in r.headers["content-disposition"]
        assert r.content.startswith(b"%PDF") and b"98765" not in r.content
    assert client.get("/api/report.pdf?persona_id=nobody").status_code == 404


def test_certificate_downloads_as_a_pdf_in_three_languages(client):
    deal_id = _settle_a_handover(client)
    for lang in ("en", "hi", "kn"):
        r = client.get(f"/api/certificate/{deal_id}.pdf?lang={lang}")
        assert r.status_code == 200 and r.content.startswith(b"%PDF")
    assert client.get("/api/certificate/nope.pdf").status_code == 404
    assert client.get(f"/api/certificate/{deal_id}").headers["content-type"].startswith("text/html")
