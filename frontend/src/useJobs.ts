import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import type { AgentEvent, AppState, Job } from "./types";

/**
 * Tracks the most recent agent job: polls its events (for Mission control) and refreshes
 * the map state while it runs. Polling works across Cloud Run instances, unlike SSE.
 */
export function useJobs() {
  const [state, setState] = useState<AppState | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const lastTs = useRef(0);
  const doneCallbacks = useRef<Map<string, (j: Job) => void>>(new Map());

  const refresh = useCallback(async () => {
    try {
      setState(await api.state());
      setError(null);
    } catch (e) {
      setError(`Can't reach the Kintsugi API (${(e as Error).message}). Is the backend running?`);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const track = useCallback((j: Job, onDone?: (j: Job) => void) => {
    lastTs.current = 0;
    setEvents([]);
    setJob(j);
    if (onDone) doneCallbacks.current.set(j.id, onDone);
  }, []);

  useEffect(() => {
    if (!job || job.status === "done" || job.status === "error") return;
    let stopped = false;
    let tick = 0;
    const poll = async () => {
      if (stopped) return;
      try {
        const fresh = await api.events(job.id, lastTs.current);
        if (fresh.length) {
          lastTs.current = fresh[fresh.length - 1].ts;
          setEvents((prev) => [...prev, ...fresh]);
        }
        tick += 1;
        const status = await api.job(job.id);
        if (fresh.length || tick % 3 === 0 || status.status !== "running") await refresh();
        if (status.status === "done" || status.status === "error") {
          const rest = await api.events(job.id, lastTs.current);
          if (rest.length) setEvents((prev) => [...prev, ...rest]);
          setJob(status);
          doneCallbacks.current.get(status.id)?.(status);
          doneCallbacks.current.delete(status.id);
          return;
        }
      } catch (e) {
        setError((e as Error).message);
      }
      setTimeout(poll, 450);
    };
    poll();
    return () => {
      stopped = true;
    };
  }, [job?.id, job?.status, refresh]);

  return { state, job, events, error, refresh, track };
}
