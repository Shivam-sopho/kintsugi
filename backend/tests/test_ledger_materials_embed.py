from app.dedup import dedup_items
from app.ledger import entries_for_item, totals
from app.llm.mock_embed import embed
from app.materials import canonical_material
from app.models import Component, GeoPoint, Item, Rung
from app.vectors import cosine

LOC = GeoPoint(lat=12.9, lng=77.6)


def test_material_aliases():
    assert canonical_material("polyester textile") == "textile"
    assert canonical_material("ceramic tile") == "ceramic"
    assert canonical_material("सागौन") == "wood"
    assert canonical_material("kayu jati") == "wood"
    assert canonical_material("unobtainium") == "mixed"


def test_ledger_traces_each_component():
    it = Item(site_id="s", type="chair", location=LOC, count=2, components=[
        Component(name="frame", material="teak", est_weight_kg=4, next_life=Rung.REUSE),
        Component(name="cushion", material="foam", est_weight_kg=1, next_life=Rung.SAFE_DISPOSAL),
    ])
    entries = entries_for_item(it, "deal_x", value_inr=1000)
    t = totals(entries)
    assert t["mass_total_kg"] == 10
    assert t["mass_diverted_kg"] == 8
    assert t["co2_avoided_kg"] > 0
    assert abs(t["value_recovered_inr"] - 1000) < 0.01
    assert all(e.factor_source for e in entries)


def test_offline_embedding_is_cross_language():
    en = embed("teak doors", 256)
    hi = embed("सागौन के दरवाज़े", 256)
    id_ = embed("pintu kayu jati", 256)
    other = embed("newspaper stack", 256)
    assert cosine(en, hi) > cosine(en, other)
    assert cosine(en, id_) > cosine(en, other)


def test_dedup_merges_repeat_sightings_without_double_counting():
    v = embed("teak door", 64)
    a = Item(site_id="s", type="door", count=3, confidence=0.6, timestamps_s=[1], location=LOC, embedding=v)
    b = Item(site_id="s", type="door", count=3, confidence=0.9, timestamps_s=[9], location=LOC, embedding=v)
    c = Item(site_id="other", type="door", count=1, location=LOC, embedding=v)
    out = dedup_items([a, b, c])
    assert len(out) == 2
    merged = next(i for i in out if i.site_id == "s")
    assert merged.count == 3 and merged.confidence == 0.9 and merged.timestamps_s == [1, 9]
