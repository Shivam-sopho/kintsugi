import { useState } from "react";
import type { AppState } from "../types";
import { km } from "../labels";
import { locateMe, useWhere } from "../where";
import ItemCard from "./ItemCard";
import TakersList from "./TakersList";

/** The map as a list: who takes things nearby, and what's listed, nearest first. */
export default function NearbyList({ state, onOpenItem, onShowMap }: { state: AppState; onOpenItem: (id: string) => void; onShowMap: () => void }) {
  const where = useWhere();
  const [note, setNote] = useState<string | null>(null);
  const nearestTaker = Math.min(...state.participants.filter((p) => p.role !== "homeowner").map((p) => km(where, p.location)));
  const items = state.items
    .filter((i) => i.status === "available")
    .map((i) => ({ i, d: km(where, i.location) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 12);
  return (
    <section className="nearby">
      <div className="row between">
        <h2>Nearby, as a list</h2>
        <button type="button" className="secondary small-btn" onClick={onShowMap}>Show map</button>
      </div>
      <p className="muted small">
        {note ?? (where.mine ? "Around you, nearest first." : "Around the demo location in central Bengaluru.")}{" "}
        <button type="button" className="link" onClick={() => { setNote("Finding your location…"); locateMe().then(() => setNote(null), (e) => setNote((e as Error).message)); }}>
          {where.mine ? "Update my location" : "Use my location"}
        </button>
      </p>
      {where.mine && nearestTaker > 15 && (
        <p className="small busy-note">
          No takers within 15 km of you yet: the sample takers are in Bengaluru. A live scan from where you are finds real
          recyclers, dealers and charities near you on Google Maps.
        </p>
      )}
      <h3>Who takes things</h3>
      <TakersList state={state} from={where} />
      <h3>Listed for a next life</h3>
      {items.length ? (
        <ul className="cards">
          {items.map(({ i, d }) => <ItemCard key={i.id} item={i} distanceKm={Math.round(d * 10) / 10} onOpen={() => onOpenItem(i.id)} />)}
        </ul>
      ) : (
        <p className="muted small">Nothing listed nearby yet.</p>
      )}
    </section>
  );
}
