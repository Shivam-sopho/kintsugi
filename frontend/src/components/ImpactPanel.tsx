import type { AppState } from "../types";
import { RUNG_COLOR, RUNG_LABEL, RUNG_ORDER, inr, kg } from "../labels";
import { api } from "../api";
import { Totals } from "./MapPanel";

export default function ImpactPanel({ state }: { state: AppState }) {
  const t = state.totals;
  const settled = state.deals.filter((d) => d.status === "settled");
  if (!t.items) {
    return (
      <section>
        <h2>Impact</h2>
        <p className="muted">Nothing recorded yet. Impact is counted only when a deal settles or a pickup is accepted.</p>
      </section>
    );
  }
  const total = t.mass_total_kg || 1;
  return (
    <section className="impact">
      <h2>Impact</h2>
      <Totals state={state} />
      <p className="muted">
        {Math.round(t.diverted_fraction * 100)}% of {kg(t.mass_total_kg)} handled so far stayed out of landfill.
      </p>
      <h3>Where it went, by weight</h3>
      <div className="ladder-bar" role="img" aria-label="Weight by next life">
        {RUNG_ORDER.filter((r) => t.by_rung_kg[r]).map((r) => (
          <span key={r} style={{ flexGrow: (t.by_rung_kg[r] ?? 0) / total, background: RUNG_COLOR[r] }} title={`${RUNG_LABEL[r]}: ${kg(t.by_rung_kg[r])}`} />
        ))}
      </div>
      <ul className="legend">
        {RUNG_ORDER.filter((r) => t.by_rung_kg[r]).map((r) => (
          <li key={r}><span className="swatch" style={{ background: RUNG_COLOR[r] }} />{RUNG_LABEL[r]} {kg(t.by_rung_kg[r])}</li>
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
