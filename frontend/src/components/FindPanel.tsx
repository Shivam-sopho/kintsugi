import { replyLanguage } from "../language";
import { useState } from "react";
import { api } from "../api";
import { say } from "../speak";
import type { AppState, DesignResult, Job, SearchResult } from "../types";
import { inr, searchSummary } from "../labels";
import { getWhere } from "../where";
import BigMic from "./BigMic";
import ItemCard from "./ItemCard";
import Problem from "./Problem";
import VoiceButton from "./VoiceButton";

function toBase64(file: File): Promise<{ b64: string; mime: string }> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve({ b64: String(r.result).split(",")[1] ?? "", mime: file.type || "image/jpeg" });
    r.onerror = () => reject(new Error("Couldn't read that photo"));
    r.readAsDataURL(file);
  });
}

interface Props {
  state: AppState;
  buyerId: string; // the persona; used when they can buy
  onJob: (job: Job, onDone?: (j: Job) => void) => void;
  onDealStarted: () => void;
  onOpenItem: (id: string) => void;
  onChanged?: () => void;
}

/** "I need something": say or show what you need, pick from what's nearby, let the agents negotiate. */
export default function FindPanel({ state, buyerId: personaId, onJob, onDealStarted, onOpenItem, onChanged }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [spoken, setSpoken] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const buyers = state.participants.filter((p) => p.role === "buyer" || p.role === "ngo" || p.role === "dealer");
  const [buyerId, setBuyerId] = useState(buyers.some((b) => b.id === personaId) ? personaId : "ppl_ananya");
  const [cap, setCap] = useState("");
  const [brief, setBrief] = useState("cozy café, 40 m², warm wood");
  const [budget, setBudget] = useState("30000");
  const [design, setDesign] = useState<DesignResult | null>(null);
  const [inspiration, setInspiration] = useState<File | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [reqRadius, setReqRadius] = useState("10");
  const [reqCap, setReqCap] = useState("");
  const [reqAuto, setReqAuto] = useState(false);
  const [reqNote, setReqNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);


  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const show = (found: SearchResult[], lang: string) => {
    setResults(found);
    setPicked(new Set());
    setSpoken(null);
    void say(searchSummary(found), lang, (t) => lang !== "en" && setSpoken(t));
  };

  const searchText = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim()) return setError("Say or type what you're looking for, in any language.");
    run("Searching…", async () => show(await api.search(query, getWhere()), "en"));
  };

  const onVoice = (blob: Blob) =>
    run("Listening…", async () => {
      const t = await api.transcribe(blob, "search");
      setQuery(t.text);
      setBusy("Searching…");
      show(await api.search(t.text, getWhere()), replyLanguage(t.language));
    });

  const searchPhoto = (file: File | undefined) => {
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    form.append("lat", String(getWhere().lat));
    form.append("lng", String(getWhere().lng));
    run("Looking at your photo…", async () => show(await api.searchImage(form), "en"));
  };

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const startDeal = () => {
    const ids = [...picked];
    const sellers = new Set(ids.map((id) => state.items.find((i) => i.id === id)?.seller_id));
    if (!ids.length) return setError("Choose at least one item.");
    if (sellers.size > 1) return setError("Choose items from one seller per deal.");
    run("deal", async () => {
      const job = await api.startDeal(ids, buyerId, cap ? Number(cap) : undefined);
      onJob(job);
      setPicked(new Set());
      onDealStarted();
    });
  };

  const myRequests = state.requests.filter((r) => r.buyer_id === buyerId && r.active);

  const saveRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim().length < 2) return setError("Say or type what you need first.");
    if (reqAuto && !Number(reqCap)) return setError("Give your highest price to approve deals automatically.");
    setReqNote(null);
    run("request", async () => {
      const job = await api.createRequest({
        buyer_id: buyerId, query: query.trim(), lat: getWhere().lat, lng: getWhere().lng,
        radius_km: Number(reqRadius), cap_inr: Number(reqCap) || undefined, auto_approve: reqAuto,
      });
      onJob(job, (done) => {
        const n = ((done.result.deal_ids as string[]) ?? []).length;
        setReqNote(done.status !== "done" ? done.error ?? "Couldn't save it."
          : n ? `Saved. Your agent started ${n} deal${n > 1 ? "s" : ""} already: see Deals.`
          : "Saved. Kintsugi will tell you, or act for you, when something matching is listed.");
      });
    });
  };

  const runDesign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!brief.trim() || !Number(budget)) return setError("Describe the space and give a budget.");
    run("design", async () => {
      const image = inspiration ? await toBase64(inspiration) : undefined;
      const job = await api.design(brief, Number(budget), getWhere().lat, getWhere().lng, image);
      await new Promise<void>((resolve) =>
        onJob(job, (done) => {
          if (done.status === "done") setDesign(done.result as unknown as DesignResult);
          else setError(done.error ?? "Design failed.");
          resolve();
        }),
      );
    });
  };

  const searching = busy && busy !== "deal" && busy !== "design" ? busy : null;
  return (
    <div className="flow">
      <BigMic label="Tap and say what you need, in any language" busyLabel={searching} onAudio={onVoice} />

      <form className="search-row" onSubmit={searchText}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="teak doors, सागौन के दरवाज़े" aria-label="What you need" />
        <button className="secondary" disabled={Boolean(searching)}>Search</button>
      </form>
      <label className="capture-btn quiet slim">
        <input type="file" accept="image/*" onChange={(e) => searchPhoto(e.target.files?.[0])} />
        Search with a photo
      </label>

      {results && (
        <section className="results" aria-live="polite">
          <h3>{results.length ? `${results.length} nearby` : "Nothing nearby yet"}</h3>
          {spoken && <p className="spoken">{spoken}</p>}
          <ul className="cards">
            {results.map((r) => (
              <ItemCard key={r.item.id} item={r.item} distanceKm={r.distance_km} onOpen={() => onOpenItem(r.item.id)}
                        picked={picked.has(r.item.id)} onPick={() => toggle(r.item.id)} />
            ))}
          </ul>
          {results.length > 0 && picked.size === 0 && <p className="small muted">Tick the items you want, then let the agents negotiate.</p>}
        </section>
      )}

      {picked.size > 0 && (
        <div className="deal-box">
          <label>
            Buying as
            <select value={buyerId} onChange={(e) => setBuyerId(e.target.value)}>
              {buyers.map((b) => <option key={b.id} value={b.id}>{b.name}{b.synthetic ? " (sample)" : ""}</option>)}
            </select>
          </label>
          <label>
            Your highest price, ₹ (only your agent will know it)
            <input inputMode="numeric" value={cap} onChange={(e) => setCap(e.target.value.replace(/\D/g, ""))} placeholder="Optional" />
          </label>
          <button className="primary gold wide" onClick={startDeal} disabled={busy === "deal"}>
            Let the agents negotiate {picked.size} item{picked.size > 1 ? "s" : ""}
          </button>
        </div>
      )}
      <Problem text={error} />

      <details className="more" open={Boolean(results && results.length === 0) || myRequests.length > 0}>
        <summary>Keep looking for me</summary>
        <form className="stack" onSubmit={saveRequest}>
          <p className="small muted">
            Kintsugi checks every new listing for "{query.trim() || "what you need"}". When the seller has Autopilot on,
            your agent negotiates for you{reqAuto ? " and approves any price within your limit" : ""}.
          </p>
          <div className="row wrap">
            <label className="grow">
              Buying as
              <select value={buyerId} onChange={(e) => setBuyerId(e.target.value)}>
                {buyers.map((b) => <option key={b.id} value={b.id}>{b.name}{b.synthetic ? " (sample)" : ""}</option>)}
              </select>
            </label>
            <label>
              Within
              <select value={reqRadius} onChange={(e) => setReqRadius(e.target.value)}>
                {[5, 10, 15, 25].map((k) => <option key={k} value={k}>{k} km</option>)}
              </select>
            </label>
          </div>
          <label>
            Your highest price, ₹ (only your agent will know it)
            <input inputMode="numeric" value={reqCap} onChange={(e) => setReqCap(e.target.value.replace(/\D/g, ""))} placeholder="Optional" />
          </label>
          <label className="check">
            <input type="checkbox" checked={reqAuto} onChange={(e) => setReqAuto(e.target.checked)} />
            Approve deals automatically within my highest price
          </label>
          <button className="secondary" disabled={busy === "request"}>{busy === "request" ? "Saving…" : "Save request"}</button>
          {reqNote && <p className="small" role="status">{reqNote}</p>}
        </form>
        {myRequests.length > 0 && (
          <ul className="history">
            {myRequests.map((r) => (
              <li key={r.id}>
                <div className="row between">
                  <strong>{r.query}</strong>
                  <button type="button" className="link" onClick={() => run("cancel", async () => { await api.cancelRequest(r.id); onChanged?.(); setReqNote("Request stopped."); })}>Stop</button>
                </div>
                <span className="small muted">
                  Within {r.radius_km} km{r.auto_approve ? ", approves automatically" : ""}. {r.matched_item_ids.length + r.notified_item_ids.length} matches so far.
                </span>
              </li>
            ))}
          </ul>
        )}
      </details>

      <details className="more" open={Boolean(design)}>
        <summary>Design a space from what's nearby</summary>
        <form className="stack" onSubmit={runDesign}>
          <label>
            Describe the space
            <input value={brief} onChange={(e) => setBrief(e.target.value)} />
          </label>
          <VoiceButton hint="brief" label="Describe it by voice" onResult={(t) => setBrief(t.text)} />
          <label className="capture-btn quiet slim">
            <input type="file" accept="image/*" onChange={(e) => setInspiration(e.target.files?.[0] ?? null)} />
            {inspiration ? `Inspiration: ${inspiration.name}` : "Add a sketch or inspiration photo (optional)"}
          </label>
          <label>
            Budget, ₹
            <input inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value.replace(/\D/g, ""))} />
          </label>
          <button className="secondary" disabled={busy === "design"}>{busy === "design" ? "Architect is designing…" : "Design it"}</button>
        </form>
        {design && (
          <section className="design">
            {design.render_id ? (
              <img src={api.evidenceUrl(design.render_id)} alt={design.render_prompt} />
            ) : (
              <div className="moodboard" aria-label="Materials board">
                {design.lines.map((l) => <span key={l.item_id}>{l.type}</span>)}
              </div>
            )}
            <p>{design.concept}</p>
            <ul className="bom">
              {design.lines.map((l) => (
                <li key={l.item_id}>
                  <span>{l.quantity} × {l.type}: {l.use}</span>
                  <span>{inr(l.cost_inr)}</span>
                </li>
              ))}
            </ul>
            <p className="small muted">Estimated {inr(design.total_inr)} in reclaimed materials{!design.render_id ? ". Photo render appears in live mode." : "."}</p>
          </section>
        )}
      </details>
    </div>
  );
}
