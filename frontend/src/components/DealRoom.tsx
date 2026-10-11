import { useState } from "react";
import { api } from "../api";
import type { AppState, Deal, NegotiationTurn } from "../types";
import { LANG_LABEL, inr } from "../labels";

const ACTION: Record<NegotiationTurn["action"], string> = {
  offer: "Offer",
  counter: "Counter",
  final: "Final offer",
  accept: "Accepts",
  decline: "Declines",
};

export default function DealRoom({ state, onChanged }: { state: AppState; onChanged: () => void }) {
  const deals = [...state.deals].sort((a, b) => b.created_at - a.created_at);
  const [dealId, setDealId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deal: Deal | undefined = deals.find((d) => d.id === dealId) ?? deals[0];

  if (!deal) {
    return (
      <section>
        <h2>Deal room</h2>
        <p className="muted">No deals yet. Pick items in Find and let the agents negotiate, or run the demo.</p>
      </section>
    );
  }

  const people = Object.fromEntries(state.participants.map((p) => [p.id, p]));
  const seller = people[deal.seller_id];
  const buyer = people[deal.buyer_id];
  const sellerLang = seller?.language ?? "en";
  const buyerLang = buyer?.language ?? "en";
  const items = deal.item_ids.map((id) => state.items.find((i) => i.id === id)).filter(Boolean);

  const approve = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.approve(deal.id);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="dealroom">
      <div className="row between">
        <h2>Deal room</h2>
        {deals.length > 1 && (
          <select value={deal.id} onChange={(e) => setDealId(e.target.value)} aria-label="Choose deal">
            {deals.map((d) => <option key={d.id} value={d.id}>{d.id}</option>)}
          </select>
        )}
      </div>
      <p className="muted">{items.map((i) => `${i!.count} × ${i!.type}`).join(", ")}</p>

      <div className="phones">
        <Phone title={seller?.name ?? "Seller"} lang={sellerLang} side="seller" turns={deal.transcript} />
        <Phone title={buyer?.name ?? "Buyer"} lang={buyerLang} side="buyer" turns={deal.transcript} />
      </div>

      <div className="deal-status">
        {deal.status === "negotiating" && <p>The agents are negotiating…</p>}
        {deal.status === "no_deal" && <p>No deal. The seller's floor is above the buyer's cap.</p>}
        {deal.status === "agreed" && (
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
            <a className="secondary button" href={api.certificateUrl(deal.id)} target="_blank" rel="noreferrer">
              Open impact certificate
            </a>
          </>
        )}
        {error && <p className="error" role="alert">{error}</p>}
      </div>
    </section>
  );
}

function Phone({ title, lang, side, turns }: { title: string; lang: string; side: "seller" | "buyer"; turns: NegotiationTurn[] }) {
  return (
    <div className="phone" lang={lang}>
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
            </li>
          );
        })}
      </ol>
    </div>
  );
}
