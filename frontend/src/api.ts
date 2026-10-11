import type { AgentEvent, AppState, Deal, Job, SearchResult } from "./types";

const BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, "") ?? "";

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) {
    let detail = res.statusText;
    try {
      detail = (await res.json()).detail ?? detail;
    } catch {
      /* keep statusText */
    }
    throw new Error(`${res.status}: ${detail}`);
  }
  return res.json() as Promise<T>;
}

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const api = {
  state: () => call<AppState>("/api/state"),
  job: (id: string) => call<Job>(`/api/jobs/${id}`),
  events: (id: string, after: number) => call<AgentEvent[]>(`/api/jobs/${id}/events?after=${after}`),
  judgeMode: () => call<Job>("/api/judge-mode", { method: "POST" }),
  scan: (form: FormData) => call<Job>("/api/scan", { method: "POST", body: form }),
  search: (query: string, near?: { lat: number; lng: number }) =>
    call<SearchResult[]>("/api/search", json({ query, ...near })),
  searchImage: (form: FormData) => call<SearchResult[]>("/api/search/image", { method: "POST", body: form }),
  design: (brief: string, budget_inr: number, lat: number, lng: number) =>
    call<Job>("/api/design", json({ brief, budget_inr, lat, lng })),
  startDeal: (item_ids: string[], buyer_id: string, budget_cap_inr?: number) =>
    call<Job>("/api/deals", json({ item_ids, buyer_id, budget_cap_inr })),
  deal: (id: string) => call<Deal>(`/api/deals/${id}`),
  approve: (id: string) => call<Deal>(`/api/deals/${id}/approve`, { method: "POST" }),
  certificateUrl: (id: string) => `${BASE}/api/certificate/${id}`,
};
