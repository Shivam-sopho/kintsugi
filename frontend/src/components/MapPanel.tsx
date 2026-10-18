import type { AppState, Prediction } from "../types";
import { LANG_LABEL, inr, kg } from "../labels";
import ItemCard from "./ItemCard";
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
  onClose?: () => void; // clears the selection (the map sheet on phones)
}

export default function MapPanel({ state, siteId, predictionId, itemId, onSelectItem, onRunDemo, demoRunning, onChanged, onOffer, onClose }: Props) {
  const close = onClose && <button type="button" className="link close" onClick={onClose}>Close</button>;
  const item = itemId ? state.items.find((i) => i.id === itemId) : undefined;
  if (item)
    return <Passport key={item.id} item={item} state={state} onBack={() => onSelectItem(null)} onChanged={onChanged} onOffer={onOffer} />;

  const prediction = predictionId ? state.predictions.find((p) => p.id === predictionId) : undefined;
  if (prediction) return <>{close}<PredictionCard p={prediction} /></>;

  const site = siteId ? state.sites.find((s) => s.id === siteId) : undefined;
  if (site) {
    const items = state.items.filter((i) => i.site_id === site.id);
    return (
      <section>
        {close}
        <h2>{site.name}</h2>
        <p className="muted">{items.length} {items.length === 1 ? "kind" : "kinds"} of item. Tap one to open its passport.</p>
        <ul className="cards">
          {items.map((i) => <ItemCard key={i.id} item={i} onOpen={() => onSelectItem(i.id)} />)}
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
