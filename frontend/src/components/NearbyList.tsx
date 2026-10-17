import type { AppState } from "../types";
import { DEMO_CENTER, km } from "../labels";
import ItemCard from "./ItemCard";
import TakersList from "./TakersList";

/** The map as a list: who takes things nearby, and what's listed, nearest first. */
export default function NearbyList({ state, onOpenItem, onShowMap }: { state: AppState; onOpenItem: (id: string) => void; onShowMap: () => void }) {
  const items = state.items
    .filter((i) => i.status === "available")
    .map((i) => ({ i, d: km(DEMO_CENTER, i.location) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 12);
  return (
    <section className="nearby">
      <div className="row between">
        <h2>Nearby, as a list</h2>
        <button type="button" className="secondary small-btn" onClick={onShowMap}>Show map</button>
      </div>
      <p className="muted small">Around central Bengaluru, within 15 km.</p>
      <h3>Who takes things</h3>
      <TakersList state={state} from={DEMO_CENTER} />
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
