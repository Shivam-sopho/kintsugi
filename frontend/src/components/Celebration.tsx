import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { AppState, LedgerEvent, Standing } from "../types";
import { inr, kg, sentence } from "../labels";

/** A number that counts up from zero once. */
function Count({ to, format }: { to: number; format: (n: number) => string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setN(to);
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 1200);
      setN(to * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <>{format(n)}</>;
}

interface Props {
  dealId: string | null; // null while the hand-over is still being recorded (the card opens at once)
  figures?: { kg: number; co2e_kg: number } | null; // what it saved, straight from the hand-over
  what?: string; // the item, known before the deal reaches the app's state
  to?: string; // where it goes
  personaId: string;
  levelBefore: string | null; // the person's level before this, to spot a new one
  state: AppState;
  onClose: () => void;
  onOpenLedger: () => void;
}

/** The moment a thing is handed over or sold: what it saved, the certificate, and the person's standing. */
export default function Celebration({ dealId, figures, what: whatHint, to, personaId, levelBefore, state, onClose, onOpenLedger }: Props) {
  const [entry, setEntry] = useState<LedgerEvent | null>(null);
  const [standing, setStanding] = useState<Standing | null>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const deal = state.deals.find((d) => d.id === dealId);
  const items = (deal?.item_ids ?? []).map((id) => state.items.find((i) => i.id === id)).filter(Boolean);
  const taker = state.participants.find((p) => p.id === deal?.buyer_id);
  const sale = deal?.kind === "sale";
  const what = items.map((i) => `${i!.count > 1 ? `${i!.count} × ` : ""}${i!.type}`).join(", ") || whatHint || "Your item";
  const toName = taker?.name ?? to;

  useEffect(() => {
    closeBtn.current?.focus();
    if (!dealId) return;
    if (!figures) // a sale accepted in Handovers: look its figures up in the ledger
      api.liveLedger().then((l) => setEntry(l.feed.find((f) => f.deal_id === dealId && (f.kind === "handover" || f.kind === "sale")) ?? null), () => undefined);
    api.standing(personaId).then(setStanding, () => undefined);
  }, [dealId, personaId, figures]);
  const saved = figures ?? (entry ? { kg: entry.kg ?? 0, co2e_kg: entry.co2e_kg ?? 0 } : null);

  const newLevel = standing?.level && standing.level !== levelBefore ? standing.level : null;
  const next = standing?.next;
  const progress = next && standing ? Math.min(1, Math.max(standing.items / next.items, next.kg ? standing.kg / next.kg : 0)) : 1;

  return (
    <div className="celebrate" role="dialog" aria-modal="true" aria-labelledby="celebrate-title">
      <div className="celebrate-card">
        <svg className={`celebrate-seal ${dealId ? "" : "pending"}`} viewBox="0 0 120 120" aria-hidden="true">
          <circle className="ring" cx="60" cy="60" r="52" />
          <circle className="ring2" cx="60" cy="60" r="44" />
          {dealId && <path className="tick" d="M40 62l14 14 28-30" />}
        </svg>
        <p className="celebrate-eyebrow">{sale ? "Sold, and on to its next life" : "Handed over, no money involved"}</p>
        <h2 id="celebrate-title">{!dealId ? "Handing it over…" : sale ? `Sold for ${inr(deal?.final_price_inr)}` : "Handed over"}</h2>
        <p className="celebrate-what">{sentence(what)} {toName ? <>goes to <strong>{toName}</strong>.</> : "is on its way."}</p>

        <div className="celebrate-figures">
          <div><b>{saved ? <Count to={saved.kg} format={kg} /> : <span className="dots"><i /><i /><i /></span>}</b><span>kept out of landfill</span></div>
          <div><b>{saved ? <Count to={saved.co2e_kg} format={kg} /> : <span className="dots"><i /><i /><i /></span>}</b><span>CO2e avoided</span></div>
        </div>
        <p className="celebrate-note">Recorded in the ledger with its emission factors.</p>

        {standing?.level && (
          <div className={`celebrate-standing ${newLevel ? "new" : ""}`}>
            <span className="celebrate-badge">{newLevel ? "New level" : "Your standing"}</span>
            <strong>{standing.level}</strong>
            <span className="small">{standing.items} {standing.items === 1 ? "thing" : "things"} given a next life, {kg(standing.co2e_kg)} CO2e avoided</span>
            {next && (
              <>
                <span className="bar"><i style={{ width: `${progress * 100}%` }} /></span>
                <span className="small muted">Next: {next.name}, {next.to_go}</span>
              </>
            )}
          </div>
        )}

        {dealId && <div className="celebrate-actions">
          <a className="primary gold button" href={api.certificateUrl(dealId)} target="_blank" rel="noreferrer">View certificate</a>
          <a className="secondary button" href={api.certificatePdfUrl(dealId)} download target="_blank" rel="noreferrer">Download PDF</a>
          <button className="secondary" onClick={onOpenLedger}>See it in the ledger</button>
          <button className="link" ref={closeBtn} onClick={onClose}>Done</button>
        </div>}
        {dealId && <p className="small muted">Certificate KIN-{dealId.split("_").pop()?.toUpperCase()}</p>}
      </div>
    </div>
  );
}
