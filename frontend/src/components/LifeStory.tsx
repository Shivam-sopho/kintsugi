import type { AgentEvent, AppState, Item, Job } from "../types";
import { AGENT_LABEL, LANG_LABEL, RUNG_COLOR, RUNG_LABEL, TAKER_ROLE, inr, kg, km, sentence, isBusy } from "../labels";
import Problem from "./Problem";
import { journey } from "./Journey";
import { RungIcon } from "./Icons";
import { beforeLandfill, headedForLandfill } from "../beforeLandfill";

/**
 * The stages of a second life, the same for every item: shown as a story for one item in its
 * passport, and live while a person's own scan, hand-over or deal runs.
 */
export const STAGES = [
  { key: "scanned", title: "Scanned", who: "Scout", model: "Gemini 2.5 Pro watches and listens" },
  { key: "checked", title: "Checked by a person", who: "You", model: "People confirm what the AI saw" },
  { key: "valued", title: "Valued", who: "Scout", model: "Gemini 2.5 Flash with Google Search" },
  { key: "decided", title: "Next life chosen", who: "Ladder", model: "Rules in code, not the model" },
  { key: "taker", title: "Taker found", who: "Scout", model: "Google Maps Places" },
  { key: "handed", title: "Handed over", who: "Market", model: "Gemini 2.5 Flash agents over A2A" },
  { key: "impact", title: "Impact recorded", who: "Ledger", model: "UK Government emission factors" },
] as const;

type StageKey = (typeof STAGES)[number]["key"];

interface Told {
  key: StageKey;
  done: boolean;
  says: string; // what happened, or what will happen, for this item
  by?: string; // who did it, when it differs from the usual agent for this stage
}

/** One item's second life so far, in plain words, stage by stage. */
export function tell(item: Item, state: AppState): Told[] {
  const people = Object.fromEntries(state.participants.map((p) => [p.id, p]));
  const site = state.sites.find((s) => s.id === item.site_id);
  const deal = [...state.deals].reverse().find((d) => d.item_ids.includes(item.id) && d.status !== "no_deal");
  const { steps } = journey(item, state);
  const done = Object.fromEntries(STAGES.map((s, i) => [s.key, steps[i]?.done ?? false])) as Record<StageKey, boolean>;
  const finished = done.impact;
  if (finished) STAGES.forEach((s) => (done[s.key] = true)); // once it has its next life, every stage is behind it
  const weight = item.components.reduce((s, c) => s + c.est_weight_kg, 0) * Math.max(item.count, 1);
  const kept = weight * (item.recovered_fraction ?? 1);
  const lang = LANG_LABEL[item.language] ?? item.language;
  const sourced = item.price_sources.some((s) => s.startsWith("http"));

  const takerIds = [...new Set([item.destination_id, ...item.components.map((c) => c.destination_id)].filter(Boolean) as string[])];
  const takers = takerIds.map((id) => people[id]).filter(Boolean);
  const nearest = takers[0];
  const away = nearest ? `${km(item.location, nearest.location).toFixed(1)} km away` : "";
  const buyer = deal ? people[deal.buyer_id] : undefined;

  const says: Record<StageKey, string> = {
    scanned: `Scout found it ${site?.kind === "building" ? "on a building survey" : "at home"}${site ? ` (${site.name})` : ""}`
      + `${item.language && item.language !== "en" ? `, hearing the owner in ${lang}` : ""}: `
      + `${item.components.length} ${item.components.length === 1 ? "part" : "parts"}, about ${kg(weight)}.`,
    checked: item.verified
      ? "You confirmed what Scout saw."
      : finished
        ? `It went on Scout's reading, which was ${Math.round(item.confidence * 100)}% sure.`
      : item.hazards.length
        ? `Scout flagged a suspected hazard: ${item.hazards[0]}. It is never reused.`
        : `Scout is ${Math.round(item.confidence * 100)}% sure. Waiting for you to confirm it.`,
    valued: item.value_max_inr
      ? `Worth ${inr(item.value_min_inr)}–${inr(item.value_max_inr)} each${sourced ? ", priced with Google Search, sources below" : item.synthetic ? " (sample data)" : ""}.`
      : item.hazards.length
        ? "Not priced: a suspected hazard is never sold for reuse."
        : "No resale price: what's valuable is its materials.",
    decided: item.next_life
      ? `${RUNG_LABEL[item.next_life]}. ${item.next_life_reason}`
      : "Waiting for the ladder to choose.",
    taker: takers.length === 1
      ? `${nearest.name} (${TAKER_ROLE[nearest.role]?.toLowerCase() ?? nearest.role}), ${away}.`
      : takers.length > 1
        ? `Its parts go to ${takers.length} places. Nearest: ${nearest.name}, ${away}.`
        : "No taker nearby yet. Kintsugi keeps looking and tells you when one appears.",
    handed: !deal
      ? "Hand it over for free, or sell it if someone wants it. You choose below."
      : deal.kind === "handover"
        ? `Handed over to ${buyer?.name ?? "the taker"}. No money involved.`
        : deal.status === "settled" || deal.status === "approved"
          ? `Sold to ${buyer?.name ?? "the buyer"} for ${inr(deal.final_price_inr)}. The agents negotiated within private limits.`
          : deal.status === "agreed"
            ? `Agreed at ${inr(deal.final_price_inr)}. Waiting for ${buyer?.name ?? "the buyer"} to approve.`
            : `Agents are negotiating with ${buyer?.name ?? "the buyer"} now.`,
    impact: finished
      ? `${kg(kept)} kept out of landfill and ${kg(item.co2_avoided_kg)} CO2e avoided, recorded with its emission factors.`
      : `When it goes: about ${kg(kept)} kept out of landfill and ${kg(item.co2_avoided_kg)} CO2e avoided.`,
  };
  const by: Partial<Record<StageKey, string>> = deal?.kind === "handover" ? { handed: "You · A free hand-over, nothing to negotiate" } : {};
  return STAGES.map((s) => ({ key: s.key, done: done[s.key], says: says[s.key], by: by[s.key] }));
}

interface StoryProps {
  item: Item;
  state: AppState;
  onConfirm?: () => void; // "Looks right"
  onCorrect?: () => void; // "Correct it"
  onChoose?: () => void; // jump to "Choose how it goes"
}

/** An item's journey: where it is now and the one thing to do, where each part goes (with what to
 *  do yourself before anything is burned or landfilled), and every stage with who did it. */
export default function LifeStory({ item, state, onConfirm, onCorrect, onChoose }: StoryProps) {
  const told = tell(item, state);
  const { next } = journey(item, state);
  const now = told.findIndex((t) => !t.done);
  const finished = now === -1;
  const open = item.status === "available";
  const people = Object.fromEntries(state.participants.map((p) => [p.id, p]));
  const hasTaker = Boolean(item.destination_id || item.components.some((c) => c.destination_id));
  const count = Math.max(item.count, 1);

  return (
    <section className="journey2" aria-label="Its journey to a second life">
      <header>
        <h3>Its journey</h3>
        <span className={`status ${finished ? "ok" : ""}`}>{finished ? "Done" : `Stage ${now + 1} of ${STAGES.length}`}</span>
      </header>
      <div className="story-progress" aria-hidden="true">
        {told.map((t, i) => <span key={t.key} className={t.done ? "done" : i === now ? "now" : ""} />)}
      </div>

      <div className={`journey-now ${finished ? "done" : ""}`}>
        <span className="small muted">{finished ? "Its next life is under way" : `Now: ${STAGES[now].title.toLowerCase()}`}</span>
        <p>{next}</p>
        {open && (
          <div className="row wrap">
            {!item.verified && onConfirm && <button type="button" className="primary small-btn" onClick={onConfirm}>Looks right</button>}
            {!item.verified && onCorrect && <button type="button" className="secondary small-btn" onClick={onCorrect}>Correct it</button>}
            {item.verified && hasTaker && onChoose && <button type="button" className="primary small-btn" onClick={onChoose}>Choose how it goes</button>}
          </div>
        )}
      </div>

      <h4>Where each part goes</h4>
      <ol className="part-paths">
        {item.components.map((c) => {
          const rung = c.next_life ?? item.next_life;
          const taker = people[c.destination_id ?? item.destination_id ?? ""];
          const risk = headedForLandfill(c, item);
          return (
            <li key={c.name} className={risk ? "risk" : ""} style={{ ["--rung" as string]: rung ? RUNG_COLOR[rung] : "var(--line)" }}>
              <div className="path">
                <span className="from">
                  <strong>{sentence(c.name)}</strong>
                  <span className="small muted">{c.material}, {kg(c.est_weight_kg * count)}</span>
                </span>
                <span className="arrow" aria-hidden="true" />
                <span className="to">
                  {rung && <span className="rung-tag"><RungIcon rung={rung} /> {RUNG_LABEL[rung]}</span>}
                  <span className="small">{taker ? `${taker.name}, ${km(item.location, taker.location).toFixed(1)} km` : "No taker nearby yet"}</span>
                </span>
              </div>
              {risk && (
                <div className="before-landfill">
                  <strong>{item.hazards.length ? "Handle it safely" : rung === "recover_energy" ? "Before it's burned for energy, you can" : "Before it goes to landfill, you can"}</strong>
                  <ul>{beforeLandfill(c, item).map((t) => <li key={t}>{t}</li>)}</ul>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <h4>Every stage</h4>
      <ol className="life-stages">
        {told.map((t, i) => {
          const stage = STAGES[i];
          const phase = t.done ? "done" : i === now ? "now" : "later";
          return (
            <li key={t.key} className={phase}>
              <span className="dot" aria-hidden="true" />
              <div>
                <strong>{stage.title}</strong>
                <span className="by">{t.by ?? `${stage.who} · ${stage.model}`}</span>
                {phase !== "later" && <p>{t.says}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

// ---------------------------------------------------------------- live

const KIND_TITLE: Record<string, string> = {
  scan: "Scout is listing your things",
  handover: "Handing it over",
  deal: "The agents are negotiating",
  autopilot: "Your agent is looking for buyers",
  request: "Looking for what you need",
};

const DONE_TITLE: Record<string, (n: number) => string> = {
  scan: (n) => `Scout listed ${n} ${n === 1 ? "item" : "items"}. Your turn: check, then choose how each goes`,
  handover: () => "Handed over, and the impact is recorded",
  deal: () => "The agents have finished: see Handovers",
};

/** Which stage an event shows has been reached. */
function stageOf(e: AgentEvent): StageKey | null {
  if (e.agent === "scout") {
    if (["start", "narration", "found", "dedup"].includes(e.step)) return "scanned";
    if (e.step === "priced") return "valued";
    if (e.step === "places") return "taker";
    // The ladder picks the next life and its taker together.
    if (["passport", "hazard", "tap_test", "evidence", "take_apart"].includes(e.step)) return "taker";
  }
  if (e.agent === "ledger") return "impact";
  if (["seller", "buyer", "market"].includes(e.agent)) return "handed";
  return null;
}

interface LiveProps {
  job: Job;
  events: AgentEvent[];
  state: AppState | null;
  onOpenItem: (id: string) => void;
  onShowSteps: () => void;
}

/** A person's own scan, hand-over or deal, shown live as the same stages the demo walks through. */
export function LiveJourney({ job, events, state, onOpenItem, onShowSteps }: LiveProps) {
  const running = job.status === "running" || job.status === "queued";
  const order = STAGES.map((s) => s.key) as StageKey[];
  const reached = events.map(stageOf).filter(Boolean).map((k) => order.indexOf(k as StageKey));
  let at = reached.length ? Math.max(...reached) : job.kind === "handover" ? order.indexOf("handed") : 0;
  if (!running && job.status === "done" && job.kind === "handover") at = order.indexOf("impact");
  const last = [...events].reverse().find((e) => e.agent !== "system");
  const itemIds = (job.result.item_ids as string[] | undefined) ?? [];
  const items = state ? itemIds.map((id) => state.items.find((i) => i.id === id)).filter(Boolean) as Item[] : [];
  // A scan leaves one step to the person: checking what Scout saw.
  const yourTurn = (k: StageKey) => job.kind === "scan" && k === "checked";
  const stateOf = (i: number) => (yourTurn(order[i]) ? "you" : i < at || (!running && i <= at) ? "done" : i === at ? "now" : "");
  const dealId = (job.result.deal_id as string | undefined) ?? (events.find((e) => e.data?.deal_id)?.data.deal_id as string | undefined);
  const dealItemId = state?.deals.find((d) => d.id === dealId)?.item_ids[0];

  return (
    <section className="story live-journey">
      <div className="story-progress" role="progressbar" aria-valuemin={1} aria-valuemax={STAGES.length} aria-valuenow={at + 1}>
        {STAGES.map((s, i) => (
          <span key={s.key} className={stateOf(i)} />
        ))}
      </div>
      <p className="small muted">Stage {at + 1} of {STAGES.length}: {STAGES[at].title.toLowerCase()}</p>
      <article className="story-card" aria-live="polite">
        <h2>{running ? KIND_TITLE[job.kind] ?? "The agents are working" : job.status === "error" ? (isBusy(job.error) ? "Waiting for Gemini" : "Stopped") : DONE_TITLE[job.kind]?.(items.length) ?? "Done"}</h2>
        <ul className="model-chips" aria-label="Doing the work">
          <li>{STAGES[at].who}: {STAGES[at].model}</li>
        </ul>
        {last && (
          <p className="story-step">
            <span className="agent-dot" aria-hidden="true" />
            <strong>{AGENT_LABEL[last.agent] ?? last.agent}</strong> {last.message}
          </p>
        )}
        {job.status === "error" && <Problem text={job.error} />}
      </article>

      <ol className="chapter-list">
        {STAGES.map((s, i) => (
          <li key={s.key} className={stateOf(i)}>{s.title}{yourTurn(s.key) ? ": your turn, once it's listed" : ""}</li>
        ))}
      </ol>

      {!running && items.length > 0 && (
        <>
          <h3>Follow each one's second life</h3>
          <ul className="history">
            {items.map((i) => (
              <li key={i.id}>
                <button type="button" className="link" onClick={() => onOpenItem(i.id)}>{sentence(i.type)}</button>
                <span className="small muted">{i.next_life ? RUNG_LABEL[i.next_life] : "Not decided"} · next: check it and choose how it goes</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {!running && !items.length && dealItemId && (
        <button type="button" className="secondary" onClick={() => onOpenItem(dealItemId)}>See its whole story</button>
      )}
      <button type="button" className="link" onClick={onShowSteps}>See every step ({events.length})</button>
    </section>
  );
}
