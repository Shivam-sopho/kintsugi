import { useEffect, useRef } from "react";
import type { AgentEvent, Job } from "../types";
import { AGENT_LABEL, BUSY, isBusy } from "../labels";
import { AGENT_MODELS } from "./DemoStory";

const ORDER = ["oracle", "scout", "architect", "seller", "buyer", "bundler", "ledger"];

export default function MissionControl({ job, events, onSkip }: { job: Job | null; events: AgentEvent[]; onSkip: () => void }) {
  const end = useRef<HTMLLIElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [events.length]);

  if (!job) {
    return (
      <section>
        <h2>Agents</h2>
        <p className="muted">Every step the agents take shows up here, live. Start a scan, a search or the demo.</p>
      </section>
    );
  }

  const active = new Set(events.map((e) => e.agent));
  const t0 = events[0]?.ts ?? 0;
  return (
    <section className="mission">
      <div className="row between">
        <h2>Agents</h2>
        {job.kind === "judge_mode" && job.status === "running" && (
          <button className="link" onClick={onSkip}>Skip to the end</button>
        )}
      </div>
      <ul className="agent-strip" aria-label="Agents that have acted">
        {ORDER.map((a) => (
          <li key={a} className={active.has(a) ? `on a-${a}` : ""}>{AGENT_LABEL[a]}</li>
        ))}
      </ul>
      <ol className="timeline">
        {events.map((e, i) => (
          <li key={i} className={`a-${e.agent} s-${e.step}`}>
            <span className="who">{AGENT_LABEL[e.agent] ?? e.agent}</span>
            <span className="what">
              {e.message}
              {AGENT_MODELS[e.agent] && <span className="model">{AGENT_MODELS[e.agent][0]}</span>}
            </span>
            <span className="when">{(e.ts - t0).toFixed(1)}s</span>
          </li>
        ))}
        <li ref={end} className="end">
          {job.status === "running" ? "Working…" : job.status === "error" ? (isBusy(job.error) ? BUSY : `Stopped: ${job.error}`) : "Done."}
        </li>
      </ol>
    </section>
  );
}
