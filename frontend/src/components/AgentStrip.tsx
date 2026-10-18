import type { AgentEvent, Job } from "../types";
import { BUSY, isBusy, AGENT_LABEL } from "../labels";

interface Props {
  job: Job | null;
  events: AgentEvent[];
  onOpen: () => void; // the full Mission control timeline
  onSkip: () => void;
}

/** What the agents are doing right now, in one line, with a way into every step. */
export default function AgentStrip({ job, events, onOpen, onSkip }: Props) {
  if (!job) return null;
  const last = events[events.length - 1];
  const running = job.status === "running" || job.status === "queued";
  const text = running
    ? last?.message ?? "Starting…"
    : job.status === "error"
      ? isBusy(job.error) ? BUSY : `Stopped: ${job.error ?? "something went wrong"}`
      : last?.message ?? "Done.";
  return (
    <div className={`agent-line ${running ? "running" : job.status}`}>
      <span className="agent-dot" aria-hidden="true" />
      <span className="grow">
        <strong>{last ? AGENT_LABEL[last.agent] ?? last.agent : "Kintsugi"}</strong> {text}
      </span>
      {running && job.kind === "judge_mode" && <button type="button" className="link" onClick={onSkip}>Skip</button>}
      <button type="button" className="link" onClick={onOpen}>{job.kind === "judge_mode" || job.kind === "oracle" || job.kind === "design" ? `${events.length} steps` : "Follow it live"}</button>
    </div>
  );
}
