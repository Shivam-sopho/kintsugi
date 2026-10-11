import type { AppState, Item, Prediction } from "../types";
import { LANG_LABEL, RUNG_COLOR, RUNG_LABEL, inr, kg } from "../labels";
import Passport from "./Passport";

interface Props {
  state: AppState;
  siteId: string | null;
  predictionId: string | null;
  itemId: string | null;
  onSelectItem: (id: string | null) => void;
  onRunDemo: () => void;
  demoRunning: boolean;
  onChanged: () => void;
  onOffer: (itemId: string) => Promise<void>;
}

export default function MapPanel({ state, siteId, predictionId, itemId, onSelectItem, onRunDemo, demoRunning, onChanged, onOffer }: Props) {
  const item = itemId ? state.items.find((i) => i.id === itemId) : undefined;
  if (item)
    return <Passport key={item.id} item={item} state={state} onBack={() => onSelectItem(null)} onChanged={onChanged} onOffer={onOffer} />;

  const prediction = predictionId ? state.predictions.find((p) => p.id === predictionId) : undefined;
  if (prediction) return <PredictionCard p={prediction} />;

  const site = siteId ? state.sites.find((s) => s.id === siteId) : undefined;
  if (site) {
    const items = state.items.filter((i) => i.site_id === site.id);
    return (
      <section>
        <h2>{site.name}</h2>
        <p className="muted">{items.length} {items.length === 1 ? "kind" : "kinds"} of item. Tap one to open its passport.</p>
        <ul className="item-list">
          {items.map((i) => <ItemRow key={i.id} item={i} onClick={() => onSelectItem(i.id)} />)}
        </ul>
      </section>
    );
  }

  return (
    <section className="intro">
      <h2>Every object has a next life.</h2>
      <p>
        Film anything, from a broken chair to a whole building. Kintsugi's agents find each part's best next life,
        agree the deal in each person's language, and record what was saved.
      </p>
      <button className="primary" onClick={onRunDemo} disabled={demoRunning}>
        {demoRunning ? "Demo running…" : "Run the one-minute demo"}
      </button>
      <p className="small muted">
        The demo uses sample data in Bengaluru: one chair, one building, one city. Watch it in the Agents tab.
      </p>
      <Totals state={state} />
    </section>
  );
}

function ItemRow({ item, onClick }: { item: Item; onClick: () => void }) {
  const rung = item.next_life;
  return (
    <li>
      <button className="item-row" onClick={onClick}>
        <span className="swatch" style={{ background: rung ? RUNG_COLOR[rung] : "#B1B5BC" }} />
        <span className="grow">
          <strong>{item.type}</strong> × {item.count}
          <span className="small muted block">
            {rung ? RUNG_LABEL[rung] : "Not decided"}
            {item.value_max_inr ? `, ${inr(item.value_min_inr)}–${inr(item.value_max_inr)} each` : ""}
          </span>
        </span>
        {item.verified && <span className="status ok">confirmed</span>}
        {item.status !== "available" && <span className="status">{item.status.replace("_", " ")}</span>}
        {item.hazards.length > 0 && <span className="status hazard">hazard</span>}
      </button>
    </li>
  );
}

function PredictionCard({ p }: { p: Prediction }) {
  return (
    <section>
      <h2>{p.title}</h2>
      <p className="muted">
        {p.kind === "supply" ? "Future supply" : "Future demand"}, expected {p.expected_date || "date unknown"}
      </p>
      <p>{p.address}</p>
      {p.expected_materials.length > 0 && <p>Likely materials: {p.expected_materials.join(", ")}</p>}
      {p.source_excerpt && (
        <blockquote lang={p.source_language}>
          {p.source_excerpt}
          <footer className="small muted">Read by Oracle from a notice in {LANG_LABEL[p.source_language] ?? p.source_language}</footer>
        </blockquote>
      )}
      <p className="small muted">Confidence {Math.round(p.confidence * 100)}%{p.synthetic ? ". Sample notice." : ""}</p>
    </section>
  );
}

export function Totals({ state }: { state: AppState }) {
  const t = state.totals;
  if (!t.items) return null;
  return (
    <div className="totals">
      <div><span className="num">{kg(t.mass_diverted_kg)}</span><span className="lbl">kept out of landfill</span></div>
      <div><span className="num">{kg(t.co2_avoided_kg)}</span><span className="lbl">CO2e avoided</span></div>
      <div><span className="num">{inr(t.value_recovered_inr)}</span><span className="lbl">recovered</span></div>
    </div>
  );
}
