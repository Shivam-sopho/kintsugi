from app.demo import fixtures
from app.ladder import LadderContext, decide
from app.models import Component, GeoPoint, Item, Rung

CTX = LadderContext(fixtures.participants(), radius_km=15)


def _item(**kw) -> Item:
    base = dict(site_id="s", type="chair", location=fixtures.HOME_HSR, seller_id="ppl_home")
    base.update(kw)
    return Item(**base)


def test_broken_chair_is_taken_apart_and_routed_per_material():
    chair = _item(
        condition="D", value_min_inr=300, value_max_inr=600, repair_cost_inr=900,
        components=[
            Component(name="teak frame", material="teak", est_weight_kg=4.0),
            Component(name="steel screws", material="steel", est_weight_kg=0.3),
            Component(name="seat cushion", material="foam", est_weight_kg=1.0),
            Component(name="fabric cover", material="fabric", est_weight_kg=0.4),
        ],
    )
    d = decide(chair, CTX)
    rungs = {c.name: c.next_life for c in d.components}
    assert rungs == {
        "teak frame": Rung.HARVEST_PARTS,
        "steel screws": Rung.RECYCLE,
        "seat cushion": Rung.RECOVER_ENERGY,
        "fabric cover": Rung.RECYCLE,
    }
    assert d.next_life == Rung.HARVEST_PARTS
    assert "Repair" in d.next_life_reason  # explains why repair was skipped
    assert d.recovered_fraction == 1.0  # nothing goes to landfill


def test_repair_chosen_when_it_pays():
    d = decide(_item(condition="C", value_max_inr=2000, repair_cost_inr=400,
                     components=[Component(name="frame", material="wood", est_weight_kg=5)]), CTX)
    assert d.next_life == Rung.REPAIR
    assert d.destination_id == "ppl_lakdi"


def test_good_door_is_reused_by_nearest_taker_but_never_the_seller():
    door = _item(type="teak panel door", condition="B", location=fixtures.OFFICE_KORAMANGALA, seller_id="ppl_ramesh",
                 components=[Component(name="leaf", material="teak", est_weight_kg=28)])
    d = decide(door, CTX)
    assert d.next_life == Rung.REUSE
    assert d.destination_id != "ppl_ramesh"


def test_hazard_never_reused():
    sheet = _item(type="roofing sheet", condition="A", hazards=["suspected asbestos"],
                  components=[Component(name="sheet", material="concrete", est_weight_kg=18)])
    d = decide(sheet, CTX)
    assert d.next_life == Rung.SAFE_DISPOSAL
    assert d.destination_id == "ppl_safehaz"
    assert d.recovered_fraction == 0.0


def test_out_of_range_participants_ignored():
    far = _item(location=GeoPoint(lat=28.61, lng=77.21), condition="D",  # Delhi
                components=[Component(name="screws", material="steel", est_weight_kg=1)])
    d = decide(far, CTX)
    assert d.next_life == Rung.SAFE_DISPOSAL
