import { useState } from "react";
import { api } from "../api";
import ListenButton from "./ListenButton";
import type { AppState, Item, Job } from "../types";
import { LANG_LABEL, RUNG_COLOR, RUNG_LABEL, RUNG_ORDER, inr, kg, sentence } from "../labels";
import VoiceButton from "./VoiceButton";
import { RungIcon } from "./Icons";
import LifeStory from "./LifeStory";
import TakersList from "./TakersList";
import ExplainCard from "./ExplainCard";
import { say } from "../speak";
import Problem from "./Problem";
import { replyLanguage } from "../language";

/** What Kintsugi says once something is handed over: where it went and what it saved. */
function handedOverLine(item: Item, takers: string[]): string {
  const weight = item.components.reduce((s, c) => s + c.est_weight_kg, 0) * Math.max(item.count, 1);
  const kept = weight * (item.recovered_fraction ?? 1);
  return `Handed over. The ${item.type} goes to ${takers.join(" and ")}. That keeps ${kg(kept)} out of landfill `
    + `and avoids ${kg(item.co2_avoided_kg)} of CO2e. Your certificate is in Handovers.`;
}

const CONDITION: Record<Item["condition"], string> = { A: "Like new", B: "Good", C: "Worn", D: "Broken" };
const BUYING_ROLES = new Set(["buyer", "ngo", "dealer"]);

interface Props {
  item: Item;
  state: AppState;
  onBack?: () => void;
  onChanged: () => void;
  onOffer: (itemId: string) => Promise<void>;
  onJob?: (job: Job, onDone?: (j: Job) => void) => void;
  // The celebration: opened at once with dealId null, then completed (or closed with null on failure)
  onCelebrate?: (c: { dealId: string | null; personId: string; levelBefore: string | null; figures?: { kg: number; co2e_kg: number } | null; what?: string; to?: string } | null) => void;
}

export default function Passport({ item, state, onChanged, onOffer, onJob, onCelebrate }: Props) {
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
  const routeIds = [...new Set([item.destination_id, ...item.components.map((c) => c.destination_id)].filter(Boolean) as string[])];
  const routeNames = routeIds.map((id) => people[id]?.name).filter(Boolean) as string[];

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
        {sentence(item.type)} <span className="count">× {item.count}</span>
      </h2>
      <p className="muted">{item.description}</p>
      <ExplainCard item={item} />
      <LifeStory
        item={item}
        state={state}
        onConfirm={() => run("edit", () => api.patchItem(item.id, { verified: true }))}
        onCorrect={() => setEditing(true)}
        onChoose={() => document.getElementById(`choose-${item.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
      />
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


      {item.evidence.length > 0 && (
        <div className="evidence" aria-label="Evidence photos, faces blurred">
          {item.evidence.map((id) => <img key={id} src={api.evidenceUrl(id)} alt={`${item.type} as filmed`} />)}
        </div>
      )}

      {item.hazards.length > 0 && <p className="hazard-note">{item.hazards.join("; ")}. Never offered for reuse.</p>}

      <section className="next-life">
        <h3>Its next life, decided by the rules</h3>
        <ol className="ladder" aria-label="Next-life ladder">
          {RUNG_ORDER.map((r) => (
            <li key={r} className={r === item.next_life ? "on" : ""} style={{ ["--rung" as string]: RUNG_COLOR[r] }}>
              <RungIcon rung={r} /> {RUNG_LABEL[r]}
            </li>
          ))}
        </ol>
        <p className="reason">{item.next_life_reason}</p>
      </section>

      {open ? (
        <section className="choose" id={`choose-${item.id}`}>
          <h3>Choose how it goes</h3>
          <div className="option handover-option">
            <div className="option-head">
              <strong>{item.hazards.length ? "Hand it to a licensed handler" : "Hand it over"}</strong>
              <span className="status ok">Free</span>
            </div>
            <p className="small muted">
              {routeNames.length
                ? `It goes to ${routeNames.join(", ")}. Kintsugi records what it keeps out of landfill and the CO2e it saves.`
                : "No taker nearby yet. Kintsugi keeps looking and tells you when one appears."}
            </p>
            <button className="primary wide" disabled={busy === "handover" || !routeNames.length}
                    onClick={() => run("handover", async () => {
                      const seller = item.seller_id ?? "ppl_me";
                      const what = item.count > 1 ? `${item.count} × ${item.type}` : item.type;
                      const to = routeNames.join(", ");
                      onCelebrate?.({ dealId: null, personId: seller, levelBefore: null, what, to });
                      try {
                        const before = (await api.standing(seller).catch(() => null))?.level ?? null;
                        const job = await api.handover(item.id);
                        onChanged();
                        void say(handedOverLine(item, routeNames), replyLanguage(item.language));
                        onCelebrate?.({ dealId: String(job.result.deal_id), personId: seller, levelBefore: before, what, to,
                                        figures: { kg: Number(job.result.kg ?? 0), co2e_kg: Number(job.result.co2e_kg ?? 0) } });
                      } catch (e) {
                        onCelebrate?.(null);
                        throw e;
                      }
                    })}>
              {busy === "handover" ? "Arranging…" : item.hazards.length ? "Hand it to the licensed handler" : "Hand it over"}
            </button>
          </div>

          {!item.hazards.length && dest && BUYING_ROLES.has(dest.role) && (
            <div className="option sell-option">
              <div className="option-head">
                <strong>Sell it</strong>
                {!!item.value_max_inr && <span className="muted small">worth {inr(item.value_min_inr)}–{inr(item.value_max_inr)} each</span>}
              </div>
              <p className="small muted">{dest.name} wants it. Agents negotiate for you and the buyer, each within a private limit.</p>
              <button className="primary gold wide" disabled={busy === "offer"} onClick={() => run("offer", () => onOffer(item.id))}>
                {busy === "offer" ? "Starting…" : `Offer to ${dest.name}`}
              </button>
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
            </div>
          )}
        </section>
      ) : (
        <p className="on-its-way">On its way to its next life. {item.status === "sold" ? "Sold" : "Handed over"}; see Handovers.</p>
      )}

      <dl className="facts">
        <div><dt>Condition</dt><dd>{CONDITION[item.condition]} ({item.condition})</dd></div>
        <div><dt>Value</dt><dd>{item.value_max_inr ? `${inr(item.value_min_inr)}–${inr(item.value_max_inr)} each` : "–"}</dd></div>
        <div><dt>Weight</dt><dd>{kg(weight)}</dd></div>
        <div><dt>CO2e avoided</dt><dd>{kg(item.co2_avoided_kg)}</dd></div>
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

      <h3>Who can take it, nearest first</h3>
      <TakersList state={state} from={item.location} item={item} />

      {item.price_sources.length > 0 && (
        <p className="small muted">
          Price sources:{" "}
          {item.price_sources.map((s, i) =>
            s.startsWith("http") ? <a key={i} href={s} target="_blank" rel="noreferrer">[{i + 1}] </a> : <span key={i}>{s} </span>,
          )}
        </p>
      )}
      <Problem text={error} />
    </article>
  );
}
