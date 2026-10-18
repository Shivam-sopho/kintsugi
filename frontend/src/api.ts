import type { LiveLedger, Standing, AgentEvent, AppState, AskReply, Deal, Explanation, Item, Job, SearchResult, Transcript } from "./types";

const BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, "") ?? "";

// Files to download (PDFs). Inside the Android app, a link to another host opens in the phone's
// browser, which can save a PDF; the app's own web view can't, so files come from the API's own host.
const isNative = Boolean((window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.());
const FILES = (isNative && (import.meta.env.VITE_DOWNLOAD_BASE as string | undefined)?.replace(/\/$/, "")) || BASE;

const BUSY_RETRIES_MS = [3000, 7000]; // when Gemini is busy, wait and ask again before telling anyone

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res = await fetch(`${BASE}${path}`, init);
  for (const wait of BUSY_RETRIES_MS) {
    if (res.status !== 503 && res.status !== 429) break;
    await new Promise((r) => setTimeout(r, wait));
    res = await fetch(`${BASE}${path}`, init);
  }
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
  /** Gemini's spoken audio for a line (null when the API has none, in offline mode) and the words
   *  spoken. With `translate`, English text is read in `lang`. */
  speech: async (text: string, lang: string, translate = false): Promise<{ audio: Blob | null; spoken: string }> => {
    const res = await fetch(`${BASE}/api/speak`, json({ text, lang, translate }));
    const header = res.headers.get("X-Spoken-Text");
    const spoken = header ? decodeURIComponent(header) : text;
    return { audio: res.status === 200 ? await res.blob() : null, spoken };
  },
  state: () => call<AppState>("/api/state"),
  ask: (form: FormData) => call<AskReply>("/api/ask", { method: "POST", body: form }),
  explain: (id: string, lang: string) => call<Explanation>(`/api/items/${id}/explain?lang=${lang}`),
  handover: (id: string) => call<Job>(`/api/items/${id}/handover`, { method: "POST" }),
  itemAutopilot: (id: string, on: boolean) => call<Job>(`/api/items/${id}/autopilot`, json({ on })),
  createRequest: (body: { buyer_id: string; query: string; lat: number; lng: number; radius_km: number; cap_inr?: number; auto_approve: boolean }) =>
    call<Job>("/api/requests", json(body)),
  cancelRequest: (id: string) => call<unknown>(`/api/requests/${id}/cancel`, { method: "POST" }),
  job: (id: string) => call<Job>(`/api/jobs/${id}`),
  events: (id: string, after: number) => call<AgentEvent[]>(`/api/jobs/${id}/events?after=${after}`),
  demoRecording: () => call<{ events: { agent: string; step: string; message: string; data: Record<string, unknown> }[]; result: Record<string, unknown>; recorded_at: number }>("/api/demo/recording"),
  judgeMode: (narrated = false) => call<Job>(`/api/judge-mode${narrated ? "?narrated=true" : ""}`, { method: "POST" }),
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
  accept: (id: string) => call<Deal>(`/api/deals/${id}/accept`, { method: "POST" }),
  decline: (id: string) => call<Deal>(`/api/deals/${id}/decline`, { method: "POST" }),
  certificateUrl: (id: string, lang = "en") => `${BASE}/api/certificate/${id}?lang=${lang}`,
  certificatePdfUrl: (id: string, lang = "en") => `${FILES}/api/certificate/${id}.pdf?lang=${lang}`,
  standing: (personId: string) => call<Standing>(`/api/people/${encodeURIComponent(personId)}/standing`),
  standingPdfUrl: (personId: string) => `${FILES}/api/people/${encodeURIComponent(personId)}/certificate.pdf`,
  liveLedger: () => call<LiveLedger>("/api/ledger/live"),
  reportPdfUrl: (personaId?: string) => `${FILES}/api/report.pdf${personaId ? `?persona_id=${encodeURIComponent(personaId)}` : ""}`,
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
