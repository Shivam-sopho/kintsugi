import { useState } from "react";
import { api } from "../api";
import type { AppState, Deal, NegotiationTurn } from "../types";
import { LANG_LABEL, inr } from "../labels";
import Problem from "./Problem";
import ListenButton from "./ListenButton";

const ACTION: Record<NegotiationTurn["action"], string> = {
  offer: "Offer",
  counter: "Counter",
  final: "Final offer",
  accept: "Accepts",
  decline: "Declines",
};

export default function DealRoom({ state, onChanged }: { state: AppState; onChanged: () => void }) {
  // Offers waiting for the seller's yes come first, then the newest.
  const waiting = (d: Deal) => d.status === "agreed" && !d.seller_accepted;
  const deals = [...state.deals].sort((a, b) => Number(waiting(b)) - Number(waiting(a)) || b.created_at - a.created_at);
  const [dealId, setDealId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<"seller" | "buyer">("seller");
  const [error, setError] = useState<string | null>(null);
  const deal: Deal | undefined = deals.find((d) => d.id === dealId) ?? deals[0];

  if (!deal) {
    return (
      <section>
        <h2>Handovers</h2>
        <p className="muted">Nothing handed over yet. Open an item and choose how it goes: hand it over for free to a recycler, municipal centre, compost unit or charity, or sell it to a buyer.</p>
      </section>
    );
  }

  const people = Object.fromEntries(state.participants.map((p) => [p.id, p]));
  const seller = people[deal.seller_id];
  const buyer = people[deal.buyer_id];
  const sellerLang = seller?.language ?? "en";
  const buyerLang = buyer?.language ?? "en";
  const items = deal.item_ids.map((id) => state.items.find((i) => i.id === id)).filter(Boolean);

  if (deal.kind === "handover") {
    const it = items[0];
    const routes = it ? [...new Set([it.destination_id, ...it.components.map((c) => c.destination_id)].filter(Boolean) as string[])] : [];
    return (
      <section className="dealroom">
        <div className="row between"><h2>Handovers</h2>
          {deals.length > 1 && (
            <select value={deal.id} onChange={(e) => setDealId(e.target.value)} aria-label="Choose a handover">
              {deals.map((d) => <option key={d.id} value={d.id}>{d.kind === "handover" ? "Handed over" : "Sale"}: {d.item_ids.map((id) => state.items.find((i) => i.id === id)?.type).filter(Boolean).join(", ")}</option>)}
            </select>
          )}
        </div>
        <article className="handover-card">
          <span className="status ok">Handed over, no money involved</span>
          <h3>{it ? `${it.count > 1 ? `${it.count} × ` : ""}${it.type}` : "Item"}</h3>
          <ul className="takers">
            {routes.map((id) => (
              <li key={id}><span className="grow"><strong>{people[id]?.name ?? id}</strong>
                <span className="small muted block">{(it?.components ?? []).filter((c) => (c.destination_id ?? it?.destination_id) === id).map((c) => c.name).join(", ") || "the whole item"}</span></span></li>
            ))}
          </ul>
          {it?.co2_avoided_kg != null && <p><strong>{it.co2_avoided_kg} kg CO2e</strong> avoided, recorded in the ledger.</p>}
          <p className="row wrap">
            <a className="secondary button" href={api.certificateUrl(deal.id, sellerLang)} target="_blank" rel="noreferrer">Impact certificate</a>
            <a className="link" href={api.certificatePdfUrl(deal.id, sellerLang)} download target="_blank" rel="noreferrer">Download PDF</a>
          </p>
        </article>
      </section>
    );
  }

  const act = (fn: (id: string) => Promise<unknown>) => async () => {
    setBusy(true);
    setError(null);
    try {
      await fn(deal.id);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const approve = act(api.approve);

  return (
    <section className="dealroom">
      <div className="row between">
        <h2>Handovers</h2>
        {deals.length > 1 && (
          <select value={deal.id} onChange={(e) => setDealId(e.target.value)} aria-label="Choose a handover">
            {deals.map((d) => (
              <option key={d.id} value={d.id}>
                {d.kind === "handover" ? "Handed over" : "Sale"}: {d.item_ids.map((id) => state.items.find((i) => i.id === id)?.type).filter(Boolean).join(", ") || d.id}
              </option>
            ))}
          </select>
        )}
      </div>
      <p className="muted">
        {deal.request_id ? <span className="status autopilot">Started by {buyer?.name ?? "the buyer"}'s agent</span>
          : deal.autopilot && <span className="status autopilot">Autopilot</span>} {items.map((i) => `${i!.count} × ${i!.type}`).join(", ")}
      </p>

      {waiting(deal) && (
          <div className="offer-box">
            <p>
              Your agent and {buyer?.name ?? "the buyer"}'s agent agreed <strong>{inr(deal.final_price_inr)}</strong>, never below your
              lowest price. Nothing is sold until you accept.
            </p>
            <div className="row wrap">
              <button className="primary gold" onClick={act(api.accept)} disabled={busy}>
                {busy ? "Working…" : `Accept ${inr(deal.final_price_inr)}`}
              </button>
              <button className="secondary" onClick={act(api.decline)} disabled={busy}>Decline</button>
            </div>
          </div>
        )}

      <div className="mode-switch phone-switch" role="tablist" aria-label="Whose phone">
        <button role="tab" aria-selected={view === "seller"} className={view === "seller" ? "on" : ""} onClick={() => setView("seller")}>
          {seller?.name ?? "Seller"}, {LANG_LABEL[sellerLang] ?? sellerLang}
        </button>
        <button role="tab" aria-selected={view === "buyer"} className={view === "buyer" ? "on" : ""} onClick={() => setView("buyer")}>
          {buyer?.name ?? "Buyer"}, {LANG_LABEL[buyerLang] ?? buyerLang}
        </button>
      </div>
      <div className={`phones show-${view}`}>
        <Phone title={seller?.name ?? "Seller"} lang={sellerLang} side="seller" turns={deal.transcript} />
        <Phone title={buyer?.name ?? "Buyer"} lang={buyerLang} side="buyer" turns={deal.transcript} />
      </div>

      <div className="deal-status">
        {deal.status === "negotiating" && <p>The agents are negotiating…</p>}
        {deal.status === "no_deal" && <p>No deal. The seller's floor is above the buyer's cap.</p>}
        {deal.status === "agreed" && deal.seller_accepted && (
          <>
            <p>
              Agreed at <strong>{inr(deal.final_price_inr)}</strong>. Nothing is paid until {buyer?.name ?? "the buyer"} approves.
            </p>
            <button className="primary gold" onClick={approve} disabled={busy}>
              {busy ? "Settling…" : `Approve ${inr(deal.final_price_inr)}`}
            </button>
          </>
        )}
        {deal.status === "settled" && (
          <>
            <p>
              Settled at <strong>{inr(deal.final_price_inr)}</strong>. {deal.settlement?.label}.
            </p>
            <p className="row wrap">
              <a className="secondary button" href={api.certificateUrl(deal.id, buyerLang)} target="_blank" rel="noreferrer">
                Impact certificate
              </a>
              <a className="link" href={api.certificateUrl(deal.id, "hi")} target="_blank" rel="noreferrer">हिन्दी</a>
              <a className="link" href={api.certificateUrl(deal.id, "kn")} target="_blank" rel="noreferrer">ಕನ್ನಡ</a>
              <a className="link" href={api.certificatePdfUrl(deal.id, buyerLang)} download target="_blank" rel="noreferrer">Download PDF</a>
            </p>
          </>
        )}
        <Problem text={error} />
      </div>
    </section>
  );
}

function Phone({ title, lang, side, turns }: { title: string; lang: string; side: "seller" | "buyer"; turns: NegotiationTurn[] }) {
  return (
    <div className={`phone ${side}`} lang={lang}>
      <header>
        <strong>{title}</strong>
        <span className="small muted block">sees everything in {LANG_LABEL[lang] ?? lang}</span>
      </header>
      <ol>
        {turns.map((t, i) => {
          const mine = t.speaker === side;
          const text = t.messages[lang] ?? t.messages.en;
          return (
            <li key={i} className={mine ? "mine" : "theirs"}>
              <span className="small muted block">{mine ? "My agent" : "Their agent"}: {ACTION[t.action]}</span>
              <span>{text}</span>
              <span className="price">{inr(t.price_inr)}</span>
              {mine && t.guardrail_applied && <span className="guard small">{t.guardrail_note}</span>}
              <ListenButton className="listen" text={text} lang={t.messages[lang] ? lang : "en"} />
            </li>
          );
        })}
      </ol>
    </div>
  );
}
