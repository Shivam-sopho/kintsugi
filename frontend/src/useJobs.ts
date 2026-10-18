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
      setError(`Can't reach Kintsugi for a moment (${(e as Error).message}).`);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // A live market: buyers' agents can open negotiations at any time, so look again every few seconds.
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 8000);
    return () => clearInterval(t);
  }, [refresh]);

  const track = useCallback((j: Job, onDone?: (j: Job) => void) => {
    lastTs.current = 0;
    setEvents([]);
    setJob(j);
    if (onDone) doneCallbacks.current.set(j.id, onDone);
    // Already finished (fast jobs can be done before anyone follows them): show what it did.
    if (j.status === "done" || j.status === "error") {
      void api.events(j.id, 0).then((evs) => setEvents(evs), () => undefined);
      void refresh();
    }
  }, [refresh]);

  useEffect(() => {
    if (!job || job.status === "done" || job.status === "error") return;
    let stopped = false;
    let tick = 0;
    // If the server restarts mid-job (a new deploy), the job can never finish: after a quiet spell,
    // treat it as interrupted so nothing waits forever. The demo takes a step every second or two;
    // a scan can wait on Scout watching a long video.
    const quietLimit = job.kind === "judge_mode" ? 30_000 : 180_000;
    let lastNews = Date.now();
    const poll = async () => {
      if (stopped) return;
      try {
        const fresh = await api.events(job.id, lastTs.current);
        if (fresh.length) {
          lastTs.current = fresh[fresh.length - 1].ts;
          lastNews = Date.now();
          setEvents((prev) => [...prev, ...fresh]);
        }
        if (Date.now() - lastNews > quietLimit) {
          const stalled: Job = { ...job, status: "error", error: "This run was interrupted (the server restarted). Nothing was lost: run it again." };
          setJob(stalled);
          doneCallbacks.current.get(job.id)?.(stalled);
          doneCallbacks.current.delete(job.id);
          return;
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
