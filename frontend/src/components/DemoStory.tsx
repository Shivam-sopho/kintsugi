import { useEffect, useRef, useState } from "react";
import type { AgentEvent, AppState, Job } from "../types";
import { narrate, prefetchSpeech, setVoiceReplies, stopNarration, voiceRepliesOn } from "../speak";
import { preferredLanguage } from "../language";
import { AGENT_LABEL, inr, kg, isBusy } from "../labels";
import Problem from "./Problem";
import { api } from "../api";

/** Which Gemini model (or plain code) does each agent's work: shown so judges see where AI acts. */
export const AGENT_MODELS: Record<string, string[]> = {
  oracle: ["Gemini 2.5 Pro reads the documents"],
  scout: ["Gemini 2.5 Pro watches and listens", "Gemini 2.5 Flash prices with Google Search", "Gemini Embedding 2"],
  architect: ["Gemini 2.5 Pro designs", "Gemini 2.5 Flash Image renders"],
  seller: ["Gemini 2.5 Flash writes each move", "A2A protocol"],
  buyer: ["Gemini 2.5 Flash writes each move", "A2A protocol"],
  market: ["Rules in code hold the private limits"],
  bundler: ["Rules in code plan the route"],
  ledger: ["Rules in code, cited factors"],
};

interface Chapter {
  title: string;
  says: string; // what's happening, in plain words
  agents: string[];
  starts: (e: AgentEvent, seen: AgentEvent[]) => boolean;
}

const scoutStarts = (seen: AgentEvent[]) => seen.filter((e) => e.agent === "scout" && e.step === "start").length;

const CHAPTERS: Chapter[] = [
  {
    title: "Oracle reads public notices",
    says: "Demolition and fit-out notices in Hindi, Kannada and English become future supply and demand on the map, weeks before anything is thrown away.",
    agents: ["oracle"],
    starts: (e) => e.agent === "oracle" && e.step === "start",
  },
  {
    title: "A broken chair finds its next life",
    says: "Priya films her chair and says in Hindi that a leg is broken. Scout lists it, prices it, and the ladder decides: repairing costs more than it's worth, so its parts go to people who can use them.",
    agents: ["scout"],
    starts: (e, seen) => e.agent === "scout" && e.step === "start" && scoutStarts(seen) === 0,
  },
  {
    title: "Neighbours share one pickup",
    says: "Small things from four homes on the same street, including garden waste for the compost and biogas unit, become one pickup that's worth a dealer's trip.",
    agents: ["scout", "bundler"],
    starts: (e) => e.agent === "scout" && e.step === "neighbours",
  },
  {
    title: "A building is surveyed before demolition",
    says: "A site engineer walks through an old office. Scout lists every door, window and tile, hears a hollow tile when tapped, and flags suspected asbestos: that never goes to reuse.",
    agents: ["scout"],
    starts: (e, seen) => e.agent === "scout" && e.step === "start" && scoutStarts(seen) === 1,
  },
  {
    title: "A café is designed from what exists",
    says: "Ananya wants a cozy café. Architect designs it only from reclaimed items within 15 km, within her budget.",
    agents: ["architect"],
    starts: (e) => e.agent === "architect" && e.step === "start",
  },
  {
    title: "Two agents strike a deal",
    says: "Ramesh's agent speaks Hindi, Ananya's speaks English. They negotiate over the A2A protocol. Each keeps its owner's limit private, and code stops either side from crossing it.",
    agents: ["seller", "buyer", "market"],
    starts: (e) => e.agent === "market" && e.step === "start",
  },
  {
    title: "The impact is recorded",
    says: "Ananya approves, the sandbox payment settles, and the ledger records the kilograms kept in use and the CO2e avoided, with a certificate in three languages.",
    agents: ["ledger"],
    starts: (e) => e.agent === "ledger",
  },
];

/** What the narrator says for a chapter. */
const spoken = (c: Chapter) => `${c.title}. ${c.says}`;

/** Which chapter each event belongs to, in order. */
function chapterOf(events: AgentEvent[]): number {
  let current = -1;
  events.forEach((e, i) => {
    const next = CHAPTERS.findIndex((c, k) => k > current && c.starts(e, events.slice(0, i)));
    if (next > current) current = next;
  });
  return current;
}

interface Props {
  job: Job;
  events: AgentEvent[];
  state: AppState | null;
  onSkip: () => void;
  onShowSteps: () => void;
  onFinish: (tab: "impact" | "deals" | "map") => void;
}

/** Judge mode as a story: chapters with plain captions, the models at work and the live step. */
export default function DemoStory({ job, events, state, onSkip, onShowSteps, onFinish }: Props) {
  const done = job.status === "done";
  const failed = job.status === "error";
  const now = done ? CHAPTERS.length - 1 : Math.max(0, chapterOf(events));
  const chapter = CHAPTERS[now];
  const last = [...events].reverse().find((e) => e.agent !== "system");
  const models = [...new Set(chapter.agents.flatMap((a) => AGENT_MODELS[a] ?? []))];
  const t = state?.totals;
  const deal = state?.deals.find((d) => d.id === (job.result.deal_id as string));
  const [voice, setVoice] = useState(voiceRepliesOn());
  const lang = preferredLanguage() ?? "en";
  const told = useRef(new Set<number>());

  // Narration: every chapter is read aloud as it starts (Gemini's voice, prepared in advance so the
  // story never waits), then the recap. Closing the story or skipping stops it.
  useEffect(() => {
    CHAPTERS.forEach((c) => void prefetchSpeech(spoken(c), lang, lang !== "en"));
    return () => stopNarration();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!voice || failed) return;
    for (let i = 0; i <= now; i++) {
      if (told.current.has(i)) continue;
      told.current.add(i);
      if (!done) narrate(spoken(CHAPTERS[i]), lang); // once it's over, the recap tells the rest
    }
    if (done && !told.current.has(-1)) {
      told.current.add(-1);
      const t = state?.totals;
      narrate(
        `That's the story. Kintsugi found the best next life for a chair, a whole building and four neighbours' things, `
          + `and two agents agreed ${deal?.final_price_inr ? `${Math.round(deal.final_price_inr)} rupees` : "a price"} in Hindi and English. `
          + (t ? `${Math.round(t.mass_diverted_kg)} kilograms stayed out of landfill and ${Math.round(t.co2_avoided_kg)} kilograms of CO2e were avoided. ` : "")
          + "Now try it yourself: tap the mic on Home and say what you have.",
        lang,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, done, voice, failed]);

  const toggleVoice = () => {
    if (voice) stopNarration();
    setVoiceReplies(!voice);
    setVoice(!voice);
  };

  return (
    <section className="story">
      <div className="story-progress" role="progressbar" aria-valuemin={1} aria-valuemax={CHAPTERS.length} aria-valuenow={now + 1}>
        {CHAPTERS.map((c, i) => <span key={c.title} className={i < now || done ? "done" : i === now ? "now" : ""} />)}
      </div>
      <div className="row between">
        <p className="small muted">Chapter {now + 1} of {CHAPTERS.length} · sample data, Bengaluru</p>
        <button type="button" className={`voice-toggle small ${voice ? "on" : ""}`} onClick={toggleVoice} aria-pressed={voice}>
          {voice ? "Narration on" : "Narration off"}
        </button>
      </div>

      {!done ? (
        <article className="story-card" aria-live="polite">
          <h2>{chapter.title}</h2>
          <p>{chapter.says}</p>
          <ul className="model-chips" aria-label="Doing the work">
            {models.map((m) => <li key={m}>{m}</li>)}
          </ul>
          {last && (
            <p className="story-step">
              <span className="agent-dot" aria-hidden="true" />
              <strong>{AGENT_LABEL[last.agent] ?? last.agent}</strong> {last.message}
            </p>
          )}
          {failed && <Problem text={isBusy(job.error) ? job.error : `Stopped: ${job.error}`} />}
        </article>
      ) : (
        <article className="story-card done">
          <h2>What just happened</h2>
          <ol className="recap">
            <li>Oracle put {state?.predictions.length ?? 0} future pickups and needs on the map from public notices.</li>
            <li>Scout listed a chair, a whole office and four neighbours' items from video and voice in Hindi.</li>
            <li>The ladder chose each item's best next life: reuse, repair, parts, recycling, compost or safe disposal. Code, not the model, decides.</li>
            <li>Two agents agreed {deal?.final_price_inr ? inr(deal.final_price_inr) : "a price"} in Hindi and English over A2A, inside both private limits.</li>
          </ol>
          {t && t.items > 0 && (
            <div className="totals">
              <div><span className="num">{kg(t.mass_diverted_kg)}</span><span className="lbl">kept out of landfill</span></div>
              <div><span className="num">{kg(t.co2_avoided_kg)}</span><span className="lbl">CO2e avoided</span></div>
              <div><span className="num">{inr(t.value_recovered_inr)}</span><span className="lbl">recovered</span></div>
            </div>
          )}
          <div className="row wrap">
            <button className="primary" onClick={() => onFinish("impact")}>See the impact</button>
            <button className="secondary" onClick={() => onFinish("deals")}>Open the deal</button>
            {deal && <a className="secondary button" href={api.certificateUrl(deal.id)} target="_blank" rel="noreferrer">Certificate</a>}
          </div>
          <p className="small muted">Now try it yourself: on Home, tap the mic and say what you have, or film it.</p>
        </article>
      )}

      <ol className="chapter-list">
        {CHAPTERS.map((c, i) => (
          <li key={c.title} className={i < now || done ? "done" : i === now ? "now" : ""}>{c.title}</li>
        ))}
      </ol>
      <div className="row between">
        <button type="button" className="link" onClick={onShowSteps}>See every step ({events.length})</button>
        {!done && !failed && <button type="button" className="link" onClick={() => { stopNarration(); onSkip(); }}>Skip to the end</button>}
      </div>
    </section>
  );
}
