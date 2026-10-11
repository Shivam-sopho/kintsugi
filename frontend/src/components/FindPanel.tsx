import { useState } from "react";
import { api } from "../api";
import type { AppState, DesignResult, Job, SearchResult } from "../types";
import { DEMO_CENTER, RUNG_COLOR, RUNG_LABEL, inr } from "../labels";
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
  onJob: (job: Job, onDone?: (j: Job) => void) => void;
  onDealStarted: () => void;
  onOpenItem: (id: string) => void;
}

export default function FindPanel({ state, onJob, onDealStarted, onOpenItem }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [buyerId, setBuyerId] = useState("ppl_ananya");
  const [cap, setCap] = useState("");
  const [brief, setBrief] = useState("cozy café, 40 m², warm wood");
  const [budget, setBudget] = useState("30000");
  const [design, setDesign] = useState<DesignResult | null>(null);
  const [inspiration, setInspiration] = useState<File | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const buyers = state.participants.filter((p) => p.role === "buyer" || p.role === "ngo");

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

  const searchText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return setError("Type what you're looking for, in any language.");
    run("search", async () => setResults(await api.search(query, DEMO_CENTER)));
  };

  const searchPhoto = (file: File | undefined) => {
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    form.append("lat", String(DEMO_CENTER.lat));
    form.append("lng", String(DEMO_CENTER.lng));
    run("search", async () => setResults(await api.searchImage(form)));
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
    if (!ids.length) return setError("Pick at least one item.");
    if (sellers.size > 1) return setError("Pick items from one seller per deal.");
    run("deal", async () => {
      const job = await api.startDeal(ids, buyerId, cap ? Number(cap) : undefined);
      onJob(job);
      setPicked(new Set());
      onDealStarted();
    });
  };

  const runDesign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!brief.trim() || !Number(budget)) return setError("Describe the space and give a budget.");
    run("design", async () => {
      const image = inspiration ? await toBase64(inspiration) : undefined;
      const job = await api.design(brief, Number(budget), DEMO_CENTER.lat, DEMO_CENTER.lng, image);
      await new Promise<void>((resolve) =>
        onJob(job, (done) => {
          if (done.status === "done") setDesign(done.result as unknown as DesignResult);
          else setError(done.error ?? "Design failed.");
          resolve();
        }),
      );
    });
  };

  return (
    <div className="stack">
      <form className="stack" onSubmit={searchText}>
        <h2>Find reclaimed materials</h2>
        <label>
          Describe it in any language, or search with a photo
          <div className="row">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="teak doors, सागौन के दरवाज़े, pintu kayu jati" />
            <button className="secondary" disabled={busy === "search"}>Search</button>
          </div>
        </label>
        <div className="row wrap">
          <VoiceButton hint="search" label="Say it" onResult={(t) => { setQuery(t.text); run("search", async () => setResults(await api.search(t.text, DEMO_CENTER))); }} />
          <label className="capture-btn quiet slim">
            <input type="file" accept="image/*" onChange={(e) => searchPhoto(e.target.files?.[0])} />
            Search by photo
          </label>
        </div>
      </form>

      {results && (
        <ul className="item-list">
          {results.length === 0 && <li className="muted">Nothing nearby matches yet. Try a scan or the demo.</li>}
          {results.map((r) => (
            <li key={r.item.id} className="pick">
              <input type="checkbox" checked={picked.has(r.item.id)} onChange={() => toggle(r.item.id)} aria-label={`Pick ${r.item.type}`} />
              <button className="item-row" onClick={() => onOpenItem(r.item.id)}>
                <span className="swatch" style={{ background: r.item.next_life ? RUNG_COLOR[r.item.next_life] : "#B1B5BC" }} />
                <span className="grow">
                  <strong>{r.item.type}</strong> × {r.item.count}
                  <span className="small muted block">
                    {r.item.next_life ? RUNG_LABEL[r.item.next_life] : ""}, {inr(r.item.value_min_inr)}–{inr(r.item.value_max_inr)} each
                    {r.distance_km != null ? `, ${r.distance_km} km away` : ""}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {picked.size > 0 && (
        <div className="deal-box">
          <label>
            Buyer
            <select value={buyerId} onChange={(e) => setBuyerId(e.target.value)}>
              {buyers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <label>
            Private budget cap, ₹ (optional)
            <input inputMode="numeric" value={cap} onChange={(e) => setCap(e.target.value.replace(/\D/g, ""))} placeholder="Buyer's saved cap" />
          </label>
          <button className="primary" onClick={startDeal} disabled={busy === "deal"}>
            Let the agents negotiate {picked.size} item{picked.size > 1 ? "s" : ""}
          </button>
        </div>
      )}

      <form className="stack" onSubmit={runDesign}>
        <h2>Design from what exists</h2>
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
          {design.render_png_b64 ? (
            <img src={`data:image/png;base64,${design.render_png_b64}`} alt={design.render_prompt} />
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
          <p className="small muted">Estimated {inr(design.total_inr)} in reclaimed materials{!design.render_png_b64 ? ". Photo render appears in live mode." : "."}</p>
        </section>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
