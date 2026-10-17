import type { AgentEvent, AppState, Deal, Item, Job, SearchResult, Transcript } from "./types";

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
  /** Gemini's spoken audio for a line, or null when the API has none (offline mode). */
  speech: async (text: string, lang: string): Promise<Blob | null> => {
    const res = await fetch(`${BASE}/api/speak`, json({ text, lang }));
    return res.status === 200 ? res.blob() : null;
  },
  state: () => call<AppState>("/api/state"),
  job: (id: string) => call<Job>(`/api/jobs/${id}`),
  events: (id: string, after: number) => call<AgentEvent[]>(`/api/jobs/${id}/events?after=${after}`),
  judgeMode: () => call<Job>("/api/judge-mode", { method: "POST" }),
  scan: (form: FormData) => call<Job>("/api/scan", { method: "POST", body: form }),
  search: (query: string, near?: { lat: number; lng: number }) =>
    call<SearchResult[]>("/api/search", json({ query, ...near })),
  searchImage: (form: FormData) => call<SearchResult[]>("/api/search/image", { method: "POST", body: form }),
  design: (brief: string, budget_inr: number, lat: number, lng: number, image?: { b64: string; mime: string }) =>
    call<Job>("/api/design", json({ brief, budget_inr, lat, lng, image_b64: image?.b64, image_mime: image?.mime })),
  startDeal: (item_ids: string[], buyer_id: string, budget_cap_inr?: number) =>
    call<Job>("/api/deals", json({ item_ids, buyer_id, budget_cap_inr })),
  deal: (id: string) => call<Deal>(`/api/deals/${id}`),
  approve: (id: string) => call<Deal>(`/api/deals/${id}/approve`, { method: "POST" }),
  certificateUrl: (id: string, lang = "en") => `${BASE}/api/certificate/${id}?lang=${lang}`,
  patchItem: (id: string, patch: Partial<{ count: number; condition: string; verified: boolean; floor_price_inr: number }>) =>
    call<Item>(`/api/items/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }),
  offerItem: (id: string) => call<Job>(`/api/items/${id}/offer`, { method: "POST" }),
  evidenceUrl: (id: string) => `${BASE}/api/evidence/${id}`,
  transcribe: (audio: Blob, hint: string) => {
    const form = new FormData();
    form.append("file", audio, audioFileName(audio));
    form.append("hint", hint);
    return call<Transcript>("/api/transcribe", { method: "POST", body: form });
  },
  oracle: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return call<Job>("/api/oracle", { method: "POST", body: form });
  },
  skip: (jobId: string) => call<{ ok: boolean }>(`/api/jobs/${jobId}/skip`, { method: "POST" }),
};

export function audioFileName(blob: Blob): string {
  const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
  return `voice-note.${ext}`;
}
