import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AgentEvent, AppState, Job } from "../types";
import { narrate, prefetchSpeech, setVoiceReplies, speak, stopNarration, stopSpeaking, voiceRepliesOn } from "../speak";
import { LANGUAGES } from "../language";
import { AGENT_LABEL, inr, kg, isBusy } from "../labels";
import { Logo } from "./Icons";
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
  short: string; // the stop's name on the trail
  problem: string; // the problem this part solves
  gemini: [string, string][]; // [model or code, what it does here]
  inApp: string; // where to try it yourself
}

const scoutStarts = (seen: AgentEvent[]) => seen.filter((e) => e.agent === "scout" && e.step === "start").length;

const CHAPTERS: Chapter[] = [
  {
    title: "Oracle reads public notices",
    short: "Notices",
    problem: "Demolitions are announced weeks ahead, but nobody plans where their materials will go.",
    gemini: [["Gemini 2.5 Pro", "Reads notices in Hindi, Kannada and English, and finds what will be freed or needed"], ["Code", "Places each one on the map, and skips ones already there"]],
    inApp: "Map: the dashed rings under Coming up",
    says: "Demolition and fit-out notices in Hindi, Kannada and English become future supply and demand on the map, weeks before anything is thrown away.",
    agents: ["oracle"],
    starts: (e) => e.agent === "oracle" && e.step === "start",
  },
  {
    title: "A broken chair finds its next life",
    short: "A chair",
    problem: "A broken chair usually goes in the bin, though its wood, steel and fabric still have a use.",
    gemini: [["Gemini 2.5 Pro", "Watches the video and understands the owner speaking Hindi"], ["Gemini 2.5 Flash with Google Search", "Finds what it's worth, with sources"], ["Gemini Embedding 2", "Makes it findable in any language"], ["Code", "The ladder picks its next life: repair costs more than it's worth, so its parts go on"]],
    inApp: "Home: tap the mic or Film it, then open the item",
    says: "Priya films her chair and says in Hindi that a leg is broken. Scout lists it, prices it, and the ladder decides: repairing costs more than it's worth, so its parts go to people who can use them.",
    agents: ["scout"],
    starts: (e, seen) => e.agent === "scout" && e.step === "start" && scoutStarts(seen) === 0,
  },
  {
    title: "Neighbours share one pickup",
    short: "Neighbours",
    problem: "One small item isn't worth a dealer's trip. Four homes on one street are.",
    gemini: [["Gemini 2.5 Pro", "Lists each neighbour's things from their photos and voice notes"], ["Code", "Bundles them into one pickup route a dealer accepts"]],
    inApp: "Map: Things listed, and Handovers",
    says: "Small things from four homes on the same street, including garden waste for the compost and biogas unit, become one pickup that's worth a dealer's trip.",
    agents: ["scout", "bundler"],
    starts: (e) => e.agent === "scout" && e.step === "neighbours",
  },
  {
    title: "A building is surveyed before demolition",
    short: "A building",
    problem: "Nobody can list hundreds of doors and tiles by hand, and hazards get missed.",
    gemini: [["Gemini 2.5 Pro", "Lists every door, window and tile from a walk-through, hears a hollow tile when tapped, flags suspected asbestos"], ["Code", "Hazards never go to reuse: only to a licensed handler"]],
    inApp: "Home: Demolishing a building",
    says: "A site engineer walks through an old office. Scout lists every door, window and tile, hears a hollow tile when tapped, and flags suspected asbestos: that never goes to reuse.",
    agents: ["scout"],
    starts: (e, seen) => e.agent === "scout" && e.step === "start" && scoutStarts(seen) === 1,
  },
  {
    title: "A café is designed from what exists",
    short: "A caf\u00e9",
    problem: "Builders buy new because they can't see what's already available nearby.",
    gemini: [["Gemini 2.5 Pro", "Designs the café using only reclaimed items within 15 km and the budget"], ["Gemini 2.5 Flash Image", "Draws what it would look like"], ["Gemini Embedding 2", "Finds the matching items nearby"]],
    inApp: "Home: I need something, then Design a space",
    says: "Ananya wants a cozy café. Architect designs it only from reclaimed items within 15 km, within her budget.",
    agents: ["architect"],
    starts: (e) => e.agent === "architect" && e.step === "start",
  },
  {
    title: "Two agents strike a deal",
    short: "A deal",
    problem: "Bargaining across languages is slow, and nobody wants to reveal their limit.",
    gemini: [["Gemini 2.5 Flash", "Writes each agent's move, in Hindi for the seller and English for the buyer"], ["A2A protocol", "The buyer's agent talks to the seller's agent as a separate service"], ["Code", "Holds each side's private limit; neither agent can cross it"]],
    inApp: "Handovers: open a deal to see both phones",
    says: "Ramesh's agent speaks Hindi, Ananya's speaks English. They negotiate over the A2A protocol. Each keeps its owner's limit private, and code stops either side from crossing it.",
    agents: ["seller", "buyer", "market"],
    starts: (e) => e.agent === "market" && e.step === "start",
  },
  {
    title: "The impact is recorded",
    short: "Impact",
    problem: "Claims of being green need numbers that anyone can check.",
    gemini: [["Code", "The ledger: weight × UK Government emission factor × the share each next life avoids"], ["Gemini 2.5 Flash", "Explains in plain words what each part becomes"], ["Gemini 2.5 Flash TTS", "Reads it all aloud, in your language"]],
    inApp: "Ledger: tap How it's counted on any entry",
    says: "Ananya approves, the sandbox payment settles, and the ledger records the kilograms kept in use and the CO2e avoided, with a certificate in three languages.",
    agents: ["ledger"],
    starts: (e) => e.agent === "ledger",
  },
];


/** What the narrator says for a chapter. */
const spoken = (c: Chapter) => `${c.title}. ${c.says}`;

/** Which chapter each event belongs to, in order. */
function chapters(events: Pick<AgentEvent, "agent" | "step">[]): number[] {
  let current = -1;
  return events.map((e, i) => {
    const next = CHAPTERS.findIndex((c, k) => k > current && c.starts(e as AgentEvent, events.slice(0, i) as AgentEvent[]));
    if (next > current) current = next;
    return Math.max(current, 0);
  });
}

// One picture per chapter (48px grid, stroke follows the text colour).
const PICS: ReactNode[] = [
  <g key="n"><path d="M13 6h16l7 7v29H13z" /><path d="M29 6v7h7M18 21h13M18 27h13M18 33h8" /></g>,
  <g key="c"><path d="M15 8v32M15 22h18v18M33 22V8M15 15h18" /><path d="M11 22h26" /></g>,
  <g key="h"><path d="M5 24 14 16l9 8v14H5zM25 24l9-8 9 8v14H25z" /><path d="M12 38v-7h4v7M32 38v-7h4v7" /></g>,
  <g key="b"><path d="M10 42V12h20v30M30 22h9v20M15 18h4M21 18h4M15 25h4M21 25h4M15 32h4M21 32h4M7 42h35" /></g>,
  <g key="k"><path d="M10 18h22v10a11 11 0 0 1-22 0zM32 21h4a4 4 0 0 1 0 8h-4M15 7c-2 3 2 4 0 7M21 7c-2 3 2 4 0 7M27 7c-2 3 2 4 0 7" /></g>,
  <g key="d"><path d="M6 10h20v13H13l-7 5zM22 27h6l7 5v-5h7V14H30" /></g>,
  <g key="i"><circle cx="24" cy="24" r="16" /><path d="M16 30c0-9 7-14 16-14 0 9-6 15-15 15M17 31l8-8" /></g>,
];

type Recording = { events: Omit<AgentEvent, "job_id" | "ts">[]; result: Record<string, unknown> };

interface Props {
  recording?: Recording | null; // replay this (the usual case): paced by the narration
  job?: Job | null; // or follow a live run
  events?: AgentEvent[];
  state: AppState | null;
  onClose: () => void;
  onShowSteps: () => void;
  onFinish: (tab: "impact" | "deals" | "map") => void;
  onRefresh?: () => void;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * The demo as a full-screen story: seven chapters on a trail, each with the problem it solves, the
 * Gemini models (and the code) doing the work, the agents' live steps, and where to try it. Replays
 * are paced by the narration, so what you hear is always what you see.
 */
export default function DemoStory({ recording, job, events: liveEvents = [], state, onClose, onShowSteps, onFinish, onRefresh }: Props) {
  const replay = Boolean(recording);
  const recEvents = useMemo<AgentEvent[]>(
    () => (recording?.events ?? []).map((e, i) => ({ ...e, job_id: "replay", ts: i })), [recording]);
  const recChapters = useMemo(() => chapters(recEvents), [recEvents]);

  const [chapter, setChapter] = useState(0);
  const [shown, setShown] = useState(0);
  const shownRef = useRef(0);
  const [playing, setPlaying] = useState(true);
  const [finished, setFinished] = useState(false);
  const [lang, setLang] = useState("en"); // the judging demo starts in English; the picker changes it
  const [voice, setVoice] = useState(voiceRepliesOn());
  const reveal = (n: number) => {
    shownRef.current = n;
    setShown(n);
  };

  // What's on screen now, in either mode
  const events = replay ? recEvents.slice(0, shown) : liveEvents;
  const liveChapters = useMemo(() => chapters(liveEvents), [liveEvents]);
  const done = replay ? finished : job?.status === "done";
  const failed = !replay && job?.status === "error";
  const now = replay ? chapter : done ? CHAPTERS.length - 1 : Math.max(0, liveChapters[liveChapters.length - 1] ?? 0);
  const result = (replay ? recording?.result : job?.result) ?? {};
  const deal = state?.deals.find((d) => d.id === (result.deal_id as string));
  // The agreed price: from the deal if it's here, else as the recording kept it.
  const price = deal?.final_price_inr ?? (result.deal_price_inr as number | undefined) ?? null;
  const t = state?.totals;
  const ch = CHAPTERS[now];
  const inChapter = (replay ? recChapters : liveChapters);
  const recent = events.filter((e, i) => inChapter[i] === now && e.agent !== "system").slice(-4);

  // Get every chapter's voice ready, in the chosen language, so nothing waits.
  useEffect(() => {
    CHAPTERS.forEach((c) => void prefetchSpeech(spoken(c), lang, lang !== "en"));
  }, [lang]);
  useEffect(() => () => {
    stopNarration();
    void stopSpeaking();
  }, []);

  // The replay player: a chapter's steps appear while its narration plays; the next chapter starts
  // when both are done. Pausing, changing language or jumping restarts the current chapter's voice.
  useEffect(() => {
    if (!replay || !playing || finished) return;
    let cancelled = false;
    const idx = recChapters.map((c, i) => (c === chapter ? i : -1)).filter((i) => i >= 0);
    const start = idx[0] ?? shownRef.current;
    const end = idx.length ? idx[idx.length - 1] + 1 : shownRef.current;
    if (shownRef.current < start) reveal(start);
    const gap = Math.min(900, Math.max(300, 9000 / Math.max(idx.length, 1)));
    const timer = window.setInterval(() => {
      if (shownRef.current < end) reveal(shownRef.current + 1);
    }, gap);
    (async () => {
      const said = voice ? speak(spoken(CHAPTERS[chapter]), lang, { translate: lang !== "en" }).catch(() => undefined) : sleep(6500);
      await Promise.all([Promise.race([said, sleep(30000)]), sleep(2500)]); // never wait forever on a voice
      while (!cancelled && shownRef.current < end) await sleep(200);
      await sleep(700);
      if (cancelled) return;
      if (chapter < CHAPTERS.length - 1) setChapter(chapter + 1);
      else {
        reveal(recEvents.length);
        setFinished(true);
        onRefresh?.();
      }
    })();
    return () => {
      cancelled = true;
      clearInterval(timer);
      void stopSpeaking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replay, playing, chapter, lang, voice, finished]);

  // A live run (no recording yet): read each chapter as it starts.
  const told = useRef(new Set<number>());
  useEffect(() => {
    if (replay || !voice || failed || done) return;
    for (let i = 0; i <= now; i++) {
      if (told.current.has(i)) continue;
      told.current.add(i);
      narrate(spoken(CHAPTERS[i]), lang);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, voice, failed, done]);

  // The recap, read once at the end.
  const recapRead = useRef(false);
  useEffect(() => {
    if (!done || !voice || recapRead.current) return;
    recapRead.current = true;
    narrate(
      `That's the full circle. Kintsugi found the best next life for a chair, a whole building and four neighbours' things, `
        + `and two agents agreed ${price ? `${Math.round(price)} rupees` : "a price"} in Hindi and English. `
        + (t ? `${Math.round(t.mass_diverted_kg)} kilograms stayed out of landfill and ${Math.round(t.co2_avoided_kg)} kilograms of CO2e were avoided. ` : "")
        + "Now try it yourself.",
      lang,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, voice]);

  // Keep the current chapter in view on the trail (it scrolls sideways on phones).
  useEffect(() => {
    document.querySelector(".demo-trail li.now")?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [now, done]);

  const jump = (i: number) => {
    if (!replay) return;
    void stopSpeaking();
    const idx = recChapters.findIndex((c) => c >= i);
    reveal(i === 0 ? 0 : idx === -1 ? recEvents.length : idx);
    setFinished(false);
    recapRead.current = false;
    setChapter(i);
    setPlaying(true);
  };
  const toggleVoice = () => {
    if (voice) {
      stopNarration();
      void stopSpeaking();
    }
    setVoiceReplies(!voice);
    setVoice(!voice);
  };
  const stop = () => {
    stopNarration();
    void stopSpeaking();
    onClose();
  };
  const stopState = (i: number) => (done || i < now ? "done" : i === now ? "now" : "later");

  return (
    <div className="demo-stage" role="dialog" aria-modal="true" aria-label="The Kintsugi story">
      <header className="demo-top">
        <span className="demo-brand"><Logo size={24} /> <span>Kintsugi</span> <em>the story in one minute</em></span>
        <div className="demo-controls">
          <label className="sr-only" htmlFor="demo-lang">Narration language</label>
          <select id="demo-lang" value={lang} onChange={(e) => { void stopSpeaking(); setLang(e.target.value); }}>
            {LANGUAGES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select>
          <button type="button" className={`demo-btn-ghost ${voice ? "on" : ""}`} onClick={toggleVoice} aria-pressed={voice}>
            {voice ? "Voice on" : "Voice off"}
          </button>
          {replay && !done && (
            <button type="button" className="demo-btn-ghost" onClick={() => setPlaying(!playing)} aria-pressed={!playing}>
              {playing ? "Pause" : "Play"}
            </button>
          )}
          <button type="button" className="demo-btn-stop" onClick={stop}>Stop</button>
        </div>
      </header>

      <div className="demo-body">
        <ol className="demo-trail" aria-label="Chapters">
          {CHAPTERS.map((c, i) => (
            <li key={c.title} className={stopState(i)}>
              <button type="button" onClick={() => jump(i)} disabled={!replay} aria-current={i === now && !done ? "step" : undefined}>
                <span className="dt-node">
                  <svg viewBox="0 0 48 48" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{PICS[i]}</svg>
                </span>
                <span className="dt-label"><small>{i + 1}</small>{c.short}</span>
              </button>
            </li>
          ))}
          <li className={done ? "now" : "later"}>
            <button type="button" disabled>
              <span className="dt-node"><Logo size={24} /></span>
              <span className="dt-label"><small>✓</small>Full circle</span>
            </button>
          </li>
        </ol>

        <main className="demo-main" aria-live="polite">
          {!done ? (
            <article className="demo-chapter" key={now}>
              <p className="demo-eyebrow">Chapter {now + 1} of {CHAPTERS.length} · sample data, Bengaluru</p>
              <div className="demo-hero">
                <span className="demo-pic">
                  <svg viewBox="0 0 48 48" width="44" height="44" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{PICS[now]}</svg>
                </span>
                <div>
                  <h2>{ch.title}</h2>
                  <p className="demo-says">{ch.says}</p>
                </div>
              </div>
              <p className="demo-problem"><span>The problem</span>{ch.problem}</p>
              <div className="demo-panels">
                <section className="demo-panel">
                  <h3>Gemini at work</h3>
                  <ul className="gemini-list">
                    {ch.gemini.map(([who, does]) => (
                      <li key={who} className={who === "Code" || who.startsWith("A2A") ? "code" : "model"}>
                        <span className="who">{who}</span>
                        <span className="does">{does}</span>
                      </li>
                    ))}
                  </ul>
                </section>
                <section className="demo-panel">
                  <h3><i className="live-dot" aria-hidden="true" /> Live from the agents</h3>
                  <ol className="demo-steps">
                    {recent.length ? recent.map((e, i) => (
                      <li key={`${e.ts}-${i}`}><strong>{AGENT_LABEL[e.agent] ?? e.agent}</strong> {e.message}</li>
                    )) : <li className="muted">Starting…</li>}
                  </ol>
                </section>
              </div>
              <p className="demo-inapp"><span>Try it yourself</span>{ch.inApp}</p>
              {failed && <Problem text={isBusy(job?.error) ? job?.error : `Stopped: ${job?.error}`} />}
            </article>
          ) : (
            <article className="demo-chapter demo-recap">
              <p className="demo-eyebrow">The full circle</p>
              <h2>Nothing had to be thrown away.</h2>
              <p className="demo-says">
                People moving, renovating or demolishing usually throw things out because they don't know what else to do.
                In one minute Kintsugi found a next life for a broken chair, a whole office and four neighbours' things, and
                two agents agreed {price ? inr(price) : "a price"} across Hindi and English.
              </p>
              {t && t.items > 0 && (
                <div className="demo-figures">
                  <div><b>{kg(t.mass_diverted_kg)}</b><span>kept out of landfill</span></div>
                  <div><b>{kg(t.co2_avoided_kg)}</b><span>CO2e avoided</span></div>
                  <div><b>{inr(t.value_recovered_inr)}</b><span>recovered</span></div>
                </div>
              )}
              <h3>Gemini, behind every step</h3>
              <ul className="demo-models">
                <li><b>Gemini 2.5 Pro</b><span>Watched the videos, heard Hindi, read notices in three languages, designed the café</span></li>
                <li><b>Gemini 2.5 Flash</b><span>Priced things with Google Search, wrote every agent's message, explains what each part becomes</span></li>
                <li><b>Gemini 2.5 Flash Image</b><span>Drew the café from reclaimed items</span></li>
                <li><b>Gemini 2.5 Flash TTS</b><span>Narrated this story, and answers aloud in ten languages</span></li>
                <li><b>Gemini Embedding 2</b><span>Search across languages, and buyers' agents matched to new listings</span></li>
                <li><b>A2A protocol</b><span>The buyer's and seller's agents talk as separate services</span></li>
              </ul>
              <h3>What code guarantees</h3>
              <ul className="demo-guarantees">
                <li>The next-life ladder decides: reuse first, landfill last</li>
                <li>Suspected hazards never go to reuse</li>
                <li>Each side's price limit stays private</li>
                <li>Every number has a source</li>
              </ul>
              <div className="demo-ctas">
                <button className="primary gold" onClick={() => { stop(); onFinish("impact"); }}>Open the live ledger</button>
                <button className="secondary" onClick={() => { stop(); onFinish("deals"); }}>See the deal</button>
                {deal && <a className="secondary button" href={api.certificateUrl(deal.id)} target="_blank" rel="noreferrer">Certificate</a>}
                {replay && <button className="link" onClick={() => jump(0)}>Watch again</button>}
              </div>
            </article>
          )}
        </main>
      </div>

      <footer className="demo-foot">
        <div className="demo-progress" aria-hidden="true">
          <span style={{ width: `${done ? 100 : ((now + (replay ? 0.5 : 0.3)) / CHAPTERS.length) * 100}%` }} />
        </div>
        <div className="demo-foot-row">
          {replay && !done && <button type="button" className="demo-btn-ghost" onClick={() => jump(Math.max(0, now - 1))} disabled={now === 0}>Previous</button>}
          {replay ? <span className="demo-link">{events.length} of {recEvents.length} steps</span>
            : <button type="button" className="demo-link" onClick={onShowSteps}>Every step ({events.length})</button>}
          {replay && !done && <button type="button" className="demo-btn-ghost" onClick={() => (now < CHAPTERS.length - 1 ? jump(now + 1) : (setFinished(true), reveal(recEvents.length)))}>Next</button>}
        </div>
      </footer>
    </div>
  );
}
