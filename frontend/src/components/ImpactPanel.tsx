import type { AppState } from "../types";
import { RUNG_COLOR, RUNG_LABEL, RUNG_ORDER, inr, kg } from "../labels";
import { api } from "../api";
import { Totals } from "./MapPanel";
import { Logo, RungIcon } from "./Icons";

export default function ImpactPanel({ state }: { state: AppState }) {
  const t = state.totals;
  const settled = state.deals.filter((d) => d.status === "settled");
  // What everything listed could save once it reaches its next life, before any deal settles.
  const open = state.items.filter((i) => i.status === "available");
  const potentialKg = open.reduce((s, i) => s + i.components.reduce((a, c) => a + c.est_weight_kg, 0) * Math.max(i.count, 1), 0);
  const potentialCo2 = open.reduce((s, i) => s + (i.co2_avoided_kg ?? 0), 0);
  const potential = open.length > 0 && (
    <div className="potential">
      <h3>Waiting for a next life</h3>
      <p>
        <strong>{open.length}</strong> {open.length === 1 ? "item" : "items"} listed, <strong>{kg(potentialKg)}</strong> in all.
        When each reaches its next life, about <strong>{kg(potentialCo2)} CO2e</strong> is avoided.
      </p>
      <p className="small muted">Counted as recorded impact only once a deal settles or a pickup is accepted.</p>
    </div>
  );
  if (!t.items) {
    return (
      <section className="impact">
        <h2 className="with-mark"><Logo size={30} /> Impact</h2>
        {potential || <p className="muted">Nothing listed yet. Scan something on Home, or play the demo.</p>}
        <p className="small muted">Emission factors: {t.factor_source}.</p>
      </section>
    );
  }
  const total = t.mass_total_kg || 1;
  return (
    <section className="impact">
      <h2 className="with-mark"><Logo size={30} /> Impact</h2>
      <Totals state={state} />
      <p className="muted">
        {Math.round(t.diverted_fraction * 100)}% of {kg(t.mass_total_kg)} handled so far stayed out of landfill.
      </p>
      {potential}
      <h3>Where it went, by weight</h3>
      <div className="ladder-bar" role="img" aria-label="Weight by next life">
        {RUNG_ORDER.filter((r) => t.by_rung_kg[r]).map((r) => (
          <span key={r} style={{ flexGrow: (t.by_rung_kg[r] ?? 0) / total, background: RUNG_COLOR[r] }} title={`${RUNG_LABEL[r]}: ${kg(t.by_rung_kg[r])}`} />
        ))}
      </div>
      <ul className="legend">
        {RUNG_ORDER.filter((r) => t.by_rung_kg[r]).map((r) => (
          <li key={r} style={{ color: RUNG_COLOR[r] }}><RungIcon rung={r} /> <span className="ink">{RUNG_LABEL[r]} {kg(t.by_rung_kg[r])}</span></li>
        ))}
      </ul>
      {settled.length > 0 && (
        <>
          <h3>Certificates</h3>
          <ul className="plain">
            {settled.map((d) => (
              <li key={d.id} className="row wrap">
                <a href={api.certificateUrl(d.id)} target="_blank" rel="noreferrer">Deal {d.id}, {inr(d.final_price_inr)}</a>
                <a href={api.certificateUrl(d.id, "hi")} target="_blank" rel="noreferrer">हिन्दी</a>
                <a href={api.certificateUrl(d.id, "kn")} target="_blank" rel="noreferrer">ಕನ್ನಡ</a>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="small muted">Emission factors: {t.factor_source}.</p>
    </section>
  );
}
