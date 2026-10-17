import { useState } from "react";
import type { AgentEvent, AppState, Job } from "../types";
import AgentStrip from "./AgentStrip";
import FindPanel from "./FindPanel";
import ItemCard from "./ItemCard";
import ScanPanel from "./ScanPanel";

interface Props {
  state: AppState;
  job: Job | null;
  events: AgentEvent[];
  personaId: string;
  onJob: (job: Job, onDone?: (j: Job) => void) => void;
  onOpenItem: (id: string) => void;
  onOpenAgents: () => void;
  onSkip: () => void;
  onDealStarted: () => void;
  onRunDemo: () => void;
  demoRunning: boolean;
}

/** Home: one question, two answers. Talking is the main way in; filming, photos and typing still work. */
export default function HomePanel(p: Props) {
  const [mode, setMode] = useState<"have" | "need">("have");
  const recent = [...p.state.items].filter((i) => i.seller_id === p.personaId).slice(-4).reverse();

  return (
    <section className="home">
      <h2 className="hero">{mode === "have" ? "What would you like to give a new life?" : "What are you looking for?"}</h2>
      <div className="mode-switch" role="tablist" aria-label="What do you want to do?">
        <button role="tab" aria-selected={mode === "have"} className={mode === "have" ? "on" : ""} onClick={() => setMode("have")}>
          I have something
        </button>
        <button role="tab" aria-selected={mode === "need"} className={mode === "need" ? "on" : ""} onClick={() => setMode("need")}>
          I need something
        </button>
      </div>

      <AgentStrip job={p.job} events={p.events} onOpen={p.onOpenAgents} onSkip={p.onSkip} />

      {mode === "have" ? (
        <ScanPanel state={p.state} sellerId={p.personaId} onJob={p.onJob} onOpenItem={p.onOpenItem} />
      ) : (
        <FindPanel state={p.state} buyerId={p.personaId} onJob={p.onJob} onDealStarted={p.onDealStarted} onOpenItem={p.onOpenItem} />
      )}

      {recent.length > 0 ? (
        <section className="recent">
          <h3>Your recent items</h3>
          <ul className="cards">
            {recent.map((i) => <ItemCard key={i.id} item={i} onOpen={() => p.onOpenItem(i.id)} />)}
          </ul>
        </section>
      ) : (
        <section className="demo-invite">
          <h3>New here?</h3>
          <p className="muted">Watch the whole story in about a minute: one chair, one building, one city, with sample data from Bengaluru.</p>
          <button className="secondary" onClick={p.onRunDemo} disabled={p.demoRunning}>
            {p.demoRunning ? "Demo running…" : "Play the one-minute demo"}
          </button>
        </section>
      )}
    </section>
  );
}
