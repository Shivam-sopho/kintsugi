import type { AppState, Item } from "../types";
import { LANG_LABEL, RUNG_COLOR, RUNG_LABEL, RUNG_ORDER, inr, kg } from "../labels";

const CONDITION: Record<Item["condition"], string> = { A: "Like new", B: "Good", C: "Worn", D: "Broken" };

export default function Passport({ item, state, onBack }: { item: Item; state: AppState; onBack: () => void }) {
  const people = Object.fromEntries(state.participants.map((p) => [p.id, p]));
  const dest = item.destination_id ? people[item.destination_id] : undefined;
  const weight = item.components.reduce((s, c) => s + c.est_weight_kg, 0) * Math.max(item.count, 1);

  return (
    <article className="passport">
      <button className="link" onClick={onBack}>Back to site</button>
      <h2>
        {item.type} <span className="count">× {item.count}</span>
      </h2>
      <p className="muted">{item.description}</p>

      {item.hazards.length > 0 && (
        <p className="hazard-note">{item.hazards.join("; ")}. Never offered for reuse.</p>
      )}
      {item.needs_verification && <p className="verify-note">Low confidence: confirm this item on site.</p>}

      <ol className="ladder" aria-label="Next-life ladder">
        {RUNG_ORDER.map((r) => (
          <li key={r} className={r === item.next_life ? "on" : ""} style={{ ["--rung" as string]: RUNG_COLOR[r] }}>
            {RUNG_LABEL[r]}
          </li>
        ))}
      </ol>
      <p className="reason">{item.next_life_reason}</p>
      {dest && <p className="muted">Goes to {dest.name}</p>}

      <dl className="facts">
        <div><dt>Condition</dt><dd>{CONDITION[item.condition]} ({item.condition})</dd></div>
        <div><dt>Value</dt><dd>{item.value_max_inr ? `${inr(item.value_min_inr)}–${inr(item.value_max_inr)} each` : "–"}</dd></div>
        <div><dt>Weight</dt><dd>{kg(weight)}</dd></div>
        <div><dt>CO2 avoided</dt><dd>{kg(item.co2_avoided_kg)}</dd></div>
        <div><dt>Confidence</dt><dd>{Math.round(item.confidence * 100)}%</dd></div>
        {item.tap_test && item.tap_test !== "unknown" && <div><dt>Tap test</dt><dd>{item.tap_test}</dd></div>}
        <div><dt>Reported in</dt><dd>{LANG_LABEL[item.language] ?? item.language}</dd></div>
        {item.timestamps_s.length > 0 && <div><dt>Seen at</dt><dd>{item.timestamps_s.map((t) => `${t}s`).join(", ")}</dd></div>}
      </dl>
      {item.condition_reason && <p className="muted">{item.condition_reason}</p>}

      <h3>Parts and materials</h3>
      <table className="parts">
        <thead>
          <tr><th>Part</th><th>Material</th><th>kg</th><th>Next life</th></tr>
        </thead>
        <tbody>
          {item.components.map((c) => (
            <tr key={c.name} title={c.reason}>
              <td>{c.name}</td>
              <td>{c.material}</td>
              <td>{c.est_weight_kg}</td>
              <td>
                {c.next_life ? (
                  <span className="rung-tag" style={{ color: RUNG_COLOR[c.next_life] }}>{RUNG_LABEL[c.next_life]}</span>
                ) : "–"}
                {c.destination_id && people[c.destination_id] && (
                  <div className="muted small">{people[c.destination_id].name}</div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {item.price_sources.length > 0 && (
        <p className="small muted">
          Price sources:{" "}
          {item.price_sources.map((s, i) =>
            s.startsWith("http") ? <a key={i} href={s} target="_blank" rel="noreferrer">[{i + 1}] </a> : <span key={i}>{s} </span>,
          )}
        </p>
      )}
    </article>
  );
}
