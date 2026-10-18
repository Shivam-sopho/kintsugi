import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { AppState, LedgerEvent, LiveLedger } from "../types";
import { RUNG_COLOR, RUNG_LABEL, RUNG_ORDER, inr, kg, sentence } from "../labels";
import { Logo, RungIcon } from "./Icons";
import Problem from "./Problem";

type Filter = "all" | "handover" | "sale" | "offer" | "listed" | "pickup";
const FILTERS: [Filter, string][] = [
  ["all", "Everything"], ["handover", "Hand-overs"], ["sale", "Sales"], ["offer", "Negotiations"], ["listed", "Listed"], ["pickup", "Pickups"],
];
const KIND_LABEL: Record<LedgerEvent["kind"], string> = {
  listed: "Listed", handover: "Hand-over", offer: "Negotiation", sale: "Sale", pickup: "Pickup",
};
const OFFER_STATUS: Record<string, string> = {
  negotiating: "Agents negotiating now", waiting_for_seller: "Agreed, waiting for the seller", agreed: "Agreed, waiting for the buyer",
  approved: "Approved", settled: "Settled", no_deal: "No deal",
};

/** Seconds, minutes, hours or days ago, in words. */
function ago(at: number): string {
  const s = Math.max(0, Date.now() / 1000 - at);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(at * 1000).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/** A number that counts up to its new value, so changes are visible as they happen. */
function CountUp({ value, format }: { value: number; format: (n: number) => string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    if (start === value || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      from.current = value;
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 900);
      setShown(start + (value - start) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{format(shown)}</>;
}

/** The live ledger: what Kintsugi has done, as it happens, with every figure traced to its source. */
export default function LedgerPage({ state, personaId, onOpenItem, onOpenDeals }: {
  state: AppState; personaId: string; onOpenItem: (id: string) => void; onOpenDeals: () => void;
}) {
  const [data, setData] = useState<LiveLedger | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<string | null>(null);
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const changes = `${state.deals.length}|${state.items.length}|${state.deals.filter((d) => d.status === "settled").length}`;

  useEffect(() => {
    let alive = true;
    const load = () =>
      api.liveLedger().then((d) => {
        if (!alive) return;
        const keys = d.feed.map(key);
        if (seen.current) setFresh(new Set(keys.filter((k) => !seen.current!.has(k))));
        seen.current = new Set(keys);
        setData(d);
        setError(null);
      }, (e) => alive && setError((e as Error).message));
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), 6000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [changes]);

  if (!data) return error ? <Problem text={error} /> : <p className="muted">Opening the ledger…</p>;
  const t = data.totals;
  const c = data.counts;
  const feed = data.feed.filter((f) => filter === "all" || f.kind === filter);
  const maxMat = Math.max(1, ...data.by_material.map((m) => m.co2e_kg));
  const totalRung = Object.values(t.by_rung_kg).reduce((a, b) => a + (b ?? 0), 0) || 1;
  const settled = state.deals.filter((d) => d.status === "settled").sort((a, b) => b.created_at - a.created_at);
  const name = state.participants.find((p) => p.id === personaId)?.name;

  return (
    <section className="ledger-page">
      <header className="ledger-hero">
        <div className="ledger-hero-top">
          <span className="ledger-title"><Logo size={26} /> Live ledger</span>
          <span className="live-pill"><i className="live-dot" /> Live</span>
        </div>
        <p className="ledger-sub">Everything happening on Kintsugi, as it happens. Impact is recorded only when a hand-over, sale or pickup is done.</p>
        <div className="hero-figures">
          <div><span className="fig"><CountUp value={t.co2_avoided_kg} format={kg} /></span><span className="cap">CO2e avoided</span></div>
          <div><span className="fig"><CountUp value={t.mass_diverted_kg} format={kg} /></span><span className="cap">kept out of landfill</span></div>
          <div><span className="fig"><CountUp value={t.value_recovered_inr} format={inr} /></span><span className="cap">recovered by sellers</span></div>
        </div>
        <ul className="hero-counts">
          <li><strong>{c.handovers}</strong> {c.handovers === 1 ? "hand-over" : "hand-overs"}</li>
          <li><strong>{c.sales}</strong> {c.sales === 1 ? "sale" : "sales"}</li>
          <li className={c.negotiating ? "hot" : ""}><strong>{c.negotiating}</strong> negotiating now</li>
          {c.waiting_for_seller > 0 && <li className="hot"><button type="button" onClick={onOpenDeals}><strong>{c.waiting_for_seller}</strong> waiting for a yes</button></li>}
          <li><strong>{c.listed}</strong> {c.listed === 1 ? "thing" : "things"} listed by <strong>{c.people}</strong> {c.people === 1 ? "person" : "people"}</li>
        </ul>
      </header>

      <div className="ledger-grid">
        <div className="ledger-feed">
          <div className="feed-head">
            <h3>What's happening</h3>
            <div className="filter-chips" role="group" aria-label="Show">
              {FILTERS.map(([f, label]) => (
                <button key={f} type="button" className={filter === f ? "on" : ""} aria-pressed={filter === f} onClick={() => setFilter(f)}>{label}</button>
              ))}
            </div>
          </div>
          {!feed.length && <p className="muted">Nothing here yet. Scan something on Home, or run the demo.</p>}
          <ol className="feed">
            {feed.map((f) => {
              const k = key(f);
              const isOpen = open === k;
              return (
                <li key={k} className={`feed-row ${f.kind} ${fresh.has(k) ? "fresh" : ""}`}>
                  <span className="feed-icon" aria-hidden="true">{ICON[f.kind]}</span>
                  <div className="feed-body">
                    <p className="feed-text">{sentence(f.text)}</p>
                    <p className="feed-meta">
                      <span className={`kind-tag ${f.kind}`}>{KIND_LABEL[f.kind]}</span>
                      {f.status && <span>{OFFER_STATUS[f.status] ?? f.status}</span>}
                      <span>{ago(f.at)}</span>
                      {f.sample && <span className="status">Sample data</span>}
                    </p>
                    <div className="feed-actions">
                      {f.recorded && f.lines?.length ? (
                        <button type="button" className="link" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : k)}>
                          {isOpen ? "Hide how it's counted" : "How it's counted"}
                        </button>
                      ) : null}
                      {f.kind === "offer" && <button type="button" className="link" onClick={onOpenDeals}>See the conversation</button>}
                      {f.kind === "listed" && f.item_ids?.[0] && <button type="button" className="link" onClick={() => onOpenItem(f.item_ids![0])}>Open</button>}
                    </div>
                    {isOpen && f.lines && (
                      <div className="counted-wrap"><table className="counted">
                        <thead><tr><th>Material</th><th>Next life</th><th>kg</th><th>× factor</th><th>× share</th><th>CO2e</th></tr></thead>
                        <tbody>
                          {f.lines.map((l, i) => (
                            <tr key={i}>
                              <td>{sentence(l.material)}</td>
                              <td><span style={{ color: RUNG_COLOR[l.next_life] }}>{RUNG_LABEL[l.next_life]}</span></td>
                              <td>{l.kg}</td><td>{l.factor}</td><td>{l.share}</td><td><strong>{l.co2e_kg}</strong></td>
                            </tr>
                          ))}
                        </tbody>
                      </table></div>
                    )}
                  </div>
                  <div className="feed-figs">
                    {f.co2e_kg != null && f.co2e_kg > 0 && (
                      <span className={`co2 ${f.recorded ? "" : "maybe"}`}>{f.recorded ? "+" : "up to "}{kg(f.co2e_kg)}<small> CO2e</small></span>
                    )}
                    {f.kg != null && f.kg > 0 && <span className="small muted">{kg(f.kg)} kept</span>}
                    {f.inr != null && f.inr > 0 && <span className="small">{inr(f.inr)}</span>}
                    {f.kind === "handover" && <span className="small muted">free</span>}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        <aside className="ledger-side">
          <div className="side-card">
            <h4>Waiting for a next life</h4>
            <p className="side-big">{data.waiting.items} <small>things, {kg(data.waiting.kg)}</small></p>
            <p className="small muted">Up to {kg(data.waiting.co2e_kg)} CO2e is avoided when they reach their next life. It's recorded only once they're handed over or sold.</p>
          </div>

          {t.mass_total_kg > 0 && (
            <div className="side-card">
              <h4>Where it went</h4>
              <div className="ladder-bar" role="img" aria-label="Weight by next life">
                {RUNG_ORDER.filter((r) => t.by_rung_kg[r]).map((r) => (
                  <span key={r} style={{ flexGrow: (t.by_rung_kg[r] ?? 0) / totalRung, background: RUNG_COLOR[r] }} title={`${RUNG_LABEL[r]}: ${kg(t.by_rung_kg[r])}`} />
                ))}
              </div>
              <ul className="legend">
                {RUNG_ORDER.filter((r) => t.by_rung_kg[r]).map((r) => (
                  <li key={r} style={{ color: RUNG_COLOR[r] }}><RungIcon rung={r} /> <span className="ink">{RUNG_LABEL[r]} {kg(t.by_rung_kg[r])}</span></li>
                ))}
              </ul>
              <p className="small muted">{Math.round(t.diverted_fraction * 100)}% of everything handled stayed out of landfill.</p>
            </div>
          )}

          {data.by_material.length > 0 && (
            <div className="side-card">
              <h4>CO2e avoided, by material</h4>
              <ul className="mat-bars">
                {data.by_material.slice(0, 8).map((m) => (
                  <li key={m.material}>
                    <span className="mat-name">{sentence(m.material)}</span>
                    <span className="mat-bar"><i style={{ width: `${(m.co2e_kg / maxMat) * 100}%` }} /></span>
                    <span className="mat-val">{kg(m.co2e_kg)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="side-card">
            <h4>Reports and certificates</h4>
            <div className="downloads">
              <a className="primary button" href={api.reportPdfUrl(personaId)} download target="_blank" rel="noreferrer">My report (PDF)</a>
              <a className="secondary button" href={api.reportPdfUrl()} download target="_blank" rel="noreferrer">Everyone's (PDF)</a>
            </div>
            {name && <p className="small muted">Yours is prepared for {name}.</p>}
            {settled.length > 0 && (
              <ul className="cert-list">
                {settled.slice(0, 6).map((d) => (
                  <li key={d.id}>
                    <a href={api.certificateUrl(d.id)} target="_blank" rel="noreferrer">
                      {d.kind === "handover" ? "Hand-over" : `Sale, ${inr(d.final_price_inr)}`} · {new Date(d.created_at * 1000).toLocaleDateString()}
                    </a>
                    <span className="row">
                      <a href={api.certificateUrl(d.id, "hi")} target="_blank" rel="noreferrer">हिन्दी</a>
                      <a href={api.certificateUrl(d.id, "kn")} target="_blank" rel="noreferrer">ಕನ್ನಡ</a>
                      <a href={api.certificatePdfUrl(d.id)} download target="_blank" rel="noreferrer">PDF</a>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="side-card method">
            <h4>How every number is counted</h4>
            <p className="small">CO2e avoided = {data.method.formula}.</p>
            <p className="small muted">
              Reuse, repair and upcycling count {Math.round(data.method.reuse_replaces_new * 100)}% of making new, since not every second-hand
              thing replaces a purchase. Sources: {data.method.source}.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}

const key = (f: LedgerEvent) => `${f.kind}|${f.deal_id ?? ""}|${f.at}`;

// Small line icons for each kind of entry (24px grid, stroke follows the text colour).
const ICON: Record<LedgerEvent["kind"], JSX.Element> = {
  listed: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16v13H4zM9 7V4h6v3M9 12h6" /></svg>,
  handover: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h11M10 7l5 5-5 5M19 5v14" /></svg>,
  offer: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16v10H9l-5 4zM8 9h8M8 12h5" /></svg>,
  sale: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 4h10M7 8h10M7 4c5 0 5 8 0 8l8 8" /></svg>,
  pickup: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" /></svg>,
};
