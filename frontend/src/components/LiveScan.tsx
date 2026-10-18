import { useEffect, useRef, useState } from "react";
import type { AgentEvent, Job } from "../types";
import { AGENT_LABEL, BUSY, isBusy } from "../labels";

// The steps of a scan, each reached by an event from the agents, with what's going on in plain words.
// While a step takes a while, these describe what that step involves, a few seconds each.
const WHILE: Record<string, string[]> = {
  Watching: ["Looking at each thing in the frame", "Listening to what you said, in any language", "Spotting materials: wood, steel, glass, fabric",
    "Checking condition: scratches, cracks, broken parts", "Tapping tiles by sound, if you tapped them", "Looking out for possible hazards"],
  Listing: ["Counting how many of each", "Estimating each part's weight"],
  Valuing: ["Searching current second-hand prices", "Checking what a repair would cost"],
  "Next lives": ["Reuse first, then repair, parts, recycling", "Finding the nearest taker for each part"],
};

const STEPS: { label: string; reached: (e: AgentEvent) => boolean; doing: string }[] = [
  { label: "Preparing", reached: () => true, doing: "Making your video or photos smaller so they upload quickly." },
  { label: "Watching", reached: (e) => e.agent === "scout" && e.step === "start",
    doing: "Gemini 2.5 Pro is watching and listening, in any language. A long video can take up to a minute." },
  { label: "Listing", reached: (e) => e.agent === "scout" && (e.step === "found" || e.step === "narration"),
    doing: "Writing down each thing it saw: what it is, its parts and their materials." },
  { label: "Valuing", reached: (e) => e.agent === "scout" && e.step === "priced",
    doing: "Gemini 2.5 Flash is checking resale prices with Google Search." },
  { label: "Next lives", reached: (e) => e.agent === "scout" && ["places", "passport", "hazard", "tap_test"].includes(e.step),
    doing: "The rules choose each part's best next life and the nearest taker." },
  { label: "Finishing", reached: (e) => e.agent === "scout" && ["evidence", "take_apart"].includes(e.step),
    doing: "Saving evidence photos with faces blurred, and writing take-apart steps." },
];

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/**
 * A scan, live, right where the person started it: the steps ticking off, a timer, and the agents'
 * latest messages. Then, if buyers' agents want something, their offers starting.
 */
export default function LiveScan({ mode, job, events, preparing, onOpenDeals }: {
  mode: "scan" | "market"; job: Job | null; events: AgentEvent[]; preparing: string | null; onOpenDeals?: () => void;
}) {
  const scanning = mode === "scan" && job?.kind === "scan" && (job.status === "running" || job.status === "queued");
  const market = mode === "market" && job?.kind === "market";
  if (mode === "market") preparing = null;
  const show = Boolean(preparing) || scanning || market;
  const [started, setStarted] = useState<number | null>(null);
  const [, tick] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!show) return setStarted(null);
    setStarted((s) => s ?? Date.now());
    box.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [show]);

  if (!show) return null;
  const elapsed = started ? Math.round((Date.now() - started) / 1000) : 0;

  if (market) {
    const running = job!.status === "running" || job!.status === "queued";
    const offers = events.filter((e) => e.agent === "market" && (e.step === "offer" || e.step === "autopilot")).length;
    return (
      <div className="live-scan market" ref={box} aria-live="polite">
        <div className="live-scan-head">
          <strong>{running ? "Buyers' agents are looking at what you listed" : offers ? "Offers are in" : "No buyer wanted these yet"}</strong>
          {!running && offers > 0 && onOpenDeals && <button type="button" className="primary small-btn" onClick={onOpenDeals}>See the offers</button>}
          {running && <span className="live-pill-light"><i className="live-dot" /> Live</span>}
        </div>
        {events.length > 0 && (
          <ol className="live-scan-feed">
            {events.filter((e) => e.agent !== "system").slice(-4).map((e, i) => (
              <li key={`${e.ts}-${i}`}><strong>{AGENT_LABEL[e.agent] ?? e.agent}</strong> {e.message}</li>
            ))}
          </ol>
        )}
      </div>
    );
  }

  const reached = preparing ? 0 : Math.max(1, ...STEPS.map((s, i) => (events.some((e) => s.reached(e)) ? i : 0)));
  const failed = job?.status === "error";
  return (
    <div className="live-scan" ref={box} aria-live="polite">
      <div className="live-scan-head">
        <strong>Scout is working on your scan</strong>
        <span className="live-pill-light"><i className="live-dot" /> {mmss(elapsed)}</span>
      </div>
      <ol className="live-scan-steps">
        {STEPS.map((s, i) => (
          <li key={s.label} className={i < reached ? "done" : i === reached ? "now" : ""}>
            <span className="dot" aria-hidden="true">{i < reached ? "✓" : i + 1}</span>
            <span>{s.label}</span>
          </li>
        ))}
      </ol>
      <div className="live-scan-bar" aria-hidden="true"><span /></div>
      <p className="live-scan-doing">{preparing ?? STEPS[reached].doing}</p>
      {!preparing && WHILE[STEPS[reached].label] && (
        <p className="live-scan-sub" key={Math.floor(elapsed / 4)}>
          <span className="dots" aria-hidden="true"><i /><i /><i /></span>{" "}
          {WHILE[STEPS[reached].label][Math.floor(elapsed / 4) % WHILE[STEPS[reached].label].length]}…
        </p>
      )}
      {failed && <p className={isBusy(job?.error) ? "busy-note" : "error"}>{isBusy(job?.error) ? BUSY : job?.error}</p>}
      {events.length > 0 && (
        <ol className="live-scan-feed">
          {events.filter((e) => e.agent !== "system").slice(-4).map((e, i) => (
            <li key={`${e.ts}-${i}`}><strong>{AGENT_LABEL[e.agent] ?? e.agent}</strong> {e.message}</li>
          ))}
        </ol>
      )}
    </div>
  );
}
