import { useState } from "react";
import { api } from "../api";
import ListenButton from "./ListenButton";
import type { AppState, Item, Job } from "../types";
import { LANG_LABEL, RUNG_COLOR, RUNG_LABEL, RUNG_ORDER, inr, kg } from "../labels";
import VoiceButton from "./VoiceButton";
import { RungIcon } from "./Icons";

const CONDITION: Record<Item["condition"], string> = { A: "Like new", B: "Good", C: "Worn", D: "Broken" };
const BUYING_ROLES = new Set(["buyer", "ngo", "dealer"]);

interface Props {
  item: Item;
  state: AppState;
  onBack?: () => void;
  onChanged: () => void;
  onOffer: (itemId: string) => Promise<void>;
  onJob?: (job: Job, onDone?: (j: Job) => void) => void;
}

export default function Passport({ item, state, onChanged, onOffer, onJob }: Props) {
  const people = Object.fromEntries(state.participants.map((p) => [p.id, p]));
  const dest = item.destination_id ? people[item.destination_id] : undefined;
  const weight = item.components.reduce((s, c) => s + c.est_weight_kg, 0) * Math.max(item.count, 1);
  const [editing, setEditing] = useState(false);
  const [count, setCount] = useState(item.count);
  const [condition, setCondition] = useState(item.condition);
  const [floor, setFloor] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const langs = Object.keys(item.take_apart);
  const [stepLang, setStepLang] = useState(langs.find((l) => l !== "en") ?? "en");
  const open = item.status === "available";

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    setError(null);
    try {
      await fn();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const saveEdits = () =>
    run("edit", async () => {
      await api.patchItem(item.id, { count, condition });
      setEditing(false);
    });

  const saveFloor = (value: number) => {
    if (!value || value < 1) return setError("Enter your lowest price in rupees.");
    run("floor", async () => {
      await api.patchItem(item.id, { floor_price_inr: value });
      setFloor("");
    });
  };

  return (
    <article className="passport">
      <h2>
        {item.type} <span className="count">× {item.count}</span>
      </h2>
      <p className="muted">{item.description}</p>

      {item.evidence.length > 0 && (
        <div className="evidence" aria-label="Evidence photos, faces blurred">
          {item.evidence.map((id) => <img key={id} src={api.evidenceUrl(id)} alt={`${item.type} as filmed`} />)}
        </div>
      )}

      {item.hazards.length > 0 && <p className="hazard-note">{item.hazards.join("; ")}. Never offered for reuse.</p>}

      {/* People confirm what the AI saw */}
      {open && !editing && (
        <div className={`confirm ${item.verified ? "done" : item.needs_verification ? "warn" : ""}`}>
          {item.verified ? (
            <span>Confirmed by a person.</span>
          ) : (
            <span>{item.needs_verification ? "Low confidence: is this right?" : "Did Scout get this right?"}</span>
          )}
          {!item.verified && (
            <button className="secondary small-btn" disabled={busy === "edit"} onClick={() => run("edit", () => api.patchItem(item.id, { verified: true }))}>
              Looks right
            </button>
          )}
          <button className="link" onClick={() => setEditing(true)}>Correct it</button>
        </div>
      )}
      {editing && (
        <div className="confirm edit">
          <label>
            How many
            <input type="number" min={1} value={count} onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))} />
          </label>
          <label>
            Condition
            <select value={condition} onChange={(e) => setCondition(e.target.value as Item["condition"])}>
              {(["A", "B", "C", "D"] as const).map((c) => <option key={c} value={c}>{CONDITION[c]} ({c})</option>)}
            </select>
          </label>
          <div className="row">
            <button className="primary" onClick={saveEdits} disabled={busy === "edit"}>Save</button>
            <button className="link" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      )}

      <ol className="ladder" aria-label="Next-life ladder">
        {RUNG_ORDER.map((r) => (
          <li key={r} className={r === item.next_life ? "on" : ""} style={{ ["--rung" as string]: RUNG_COLOR[r] }}>
            <RungIcon rung={r} /> {RUNG_LABEL[r]}
          </li>
        ))}
      </ol>
      <p className="reason">{item.next_life_reason}</p>
      {dest && <p className="muted">Goes to {dest.name}</p>}

      {open && dest && BUYING_ROLES.has(dest.role) && (
        <button className="primary gold" disabled={busy === "offer"} onClick={() => run("offer", () => onOffer(item.id))}>
          {busy === "offer" ? "Starting…" : `Offer to ${dest.name}`}
        </button>
      )}

      {open && (
        <div className="floor">
          <span className="small">
            {item.has_floor_price ? "Your lowest price is set. Only your agent knows it." : "Your lowest price (only your agent will know it)"}
          </span>
          <div className="row">
            <input inputMode="numeric" placeholder="₹" value={floor} onChange={(e) => setFloor(e.target.value.replace(/\D/g, ""))} aria-label="Lowest price in rupees" />
            <button className="secondary" onClick={() => saveFloor(Number(floor))} disabled={busy === "floor"}>Set</button>
            <VoiceButton hint="floor" label="Say it" onResult={(t) => t.amount_inr && saveFloor(t.amount_inr)} />
          </div>
        </div>
      )}

      {open && (
        <div className={`autopilot-box ${item.autopilot ? "on" : ""}`}>
          <label className="switch">
            <input
              type="checkbox"
              checked={item.autopilot}
              disabled={busy === "autopilot" || item.hazards.length > 0 || (!item.has_floor_price && !item.autopilot)}
              onChange={(e) => {
                const on = e.target.checked;
                run("autopilot", async () => {
                  const job = await api.itemAutopilot(item.id, on);
                  onJob?.(job, onChanged);
                });
              }}
            />
            <span>
              <strong>Let my agent sell it</strong>
              <span className="small muted block">
                {item.hazards.length
                  ? "Suspected hazards go to a licensed handler, so they can't be sold on Autopilot."
                  : item.autopilot
                    ? "On. Your agent negotiates with buyers whose requests match, never below your lowest price."
                    : item.has_floor_price
                      ? "Your agent negotiates with matching buyers on its own, never below your lowest price."
                      : "Set your lowest price above first, so your agent knows where to stop."}
              </span>
            </span>
          </label>
        </div>
      )}

      <dl className="facts">
        <div><dt>Condition</dt><dd>{CONDITION[item.condition]} ({item.condition})</dd></div>
        <div><dt>Value</dt><dd>{item.value_max_inr ? `${inr(item.value_min_inr)}–${inr(item.value_max_inr)} each` : "–"}</dd></div>
        <div><dt>Weight</dt><dd>{kg(weight)}</dd></div>
        <div><dt>CO2 avoided</dt><dd>{kg(item.co2_avoided_kg)}</dd></div>
        {item.recovered_fraction != null && <div><dt>Kept out of landfill</dt><dd>{Math.round(item.recovered_fraction * 100)}%</dd></div>}
        <div><dt>Confidence</dt><dd>{Math.round(item.confidence * 100)}%</dd></div>
        {item.tap_test && item.tap_test !== "unknown" && <div><dt>Tap test</dt><dd>{item.tap_test}</dd></div>}
        <div><dt>Reported in</dt><dd>{LANG_LABEL[item.language] ?? item.language}</dd></div>
        {item.timestamps_s.length > 0 && <div><dt>Seen at</dt><dd>{item.timestamps_s.map((t) => `${t}s`).join(", ")}</dd></div>}
      </dl>
      {item.condition_reason && <p className="muted">{item.condition_reason}</p>}

      {langs.length > 0 && (
        <section className="steps">
          <div className="row between">
            <h3>How to take it apart</h3>
            {langs.length > 1 && (
              <select value={stepLang} onChange={(e) => setStepLang(e.target.value)} aria-label="Language">
                {langs.map((l) => <option key={l} value={l}>{LANG_LABEL[l] ?? l}</option>)}
              </select>
            )}
          </div>
          <ol lang={stepLang}>
            {item.take_apart[stepLang].map((s, i) => <li key={i}>{s}</li>)}
          </ol>
          <ListenButton text={item.take_apart[stepLang].join(" ")} lang={stepLang} />
        </section>
      )}

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
                {c.next_life ? <span className="rung-tag" style={{ color: RUNG_COLOR[c.next_life] }}>{RUNG_LABEL[c.next_life]}</span> : "–"}
                {c.destination_id && people[c.destination_id] && <div className="muted small">{people[c.destination_id].name}</div>}
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
      {error && <p className="error" role="alert">{error}</p>}
    </article>
  );
}
