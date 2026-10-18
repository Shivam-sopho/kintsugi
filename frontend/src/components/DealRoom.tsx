import { useState } from "react";
import { api } from "../api";
import type { AppState, Deal, NegotiationTurn } from "../types";
import { LANG_LABEL, RUNG_LABEL, inr, kg } from "../labels";
import Problem from "./Problem";
import ListenButton from "./ListenButton";

const ACTION: Record<NegotiationTurn["action"], string> = {
  offer: "Offer",
  counter: "Counter",
  final: "Final offer",
  accept: "Accepts",
  decline: "Declines",
};

interface Props {
  state: AppState;
  onChanged: () => void;
  onOpenItem?: (id: string) => void;
  onCelebrate?: (c: { dealId: string | null; personId: string; levelBefore: string | null } | null) => void;
}

export default function DealRoom({ state, onChanged, onOpenItem, onCelebrate }: Props) {
  // Offers waiting for the seller's yes come first, then the newest.
  const waiting = (d: Deal) => d.status === "agreed" && !d.seller_accepted;
  const deals = [...state.deals].sort((a, b) => Number(waiting(b)) - Number(waiting(a)) || b.created_at - a.created_at);
  const [dealId, setDealId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<"seller" | "buyer">("seller");
  const [error, setError] = useState<string | null>(null);
  const deal: Deal | undefined = deals.find((d) => d.id === dealId);

  if (!deal) return <Connections state={state} deals={deals} onOpenDeal={setDealId} onOpenItem={onOpenItem} />;
  const back = <button type="button" className="secondary small-btn" onClick={() => setDealId(null)}>All handovers</button>;

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
        <div className="row between"><h2>Hand-over</h2>{back}</div>
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
        <h2>Deal</h2>
        {back}
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
              <button className="primary gold" onClick={act(async (id) => {
                const before = (await api.standing(deal.seller_id).catch(() => null))?.level ?? null;
                const out = await api.accept(id);
                if (out.status === "settled") onCelebrate?.({ dealId: id, personId: deal.seller_id, levelBefore: before });
              })} disabled={busy}>
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

const STATUS: Record<Deal["status"], string> = {
  negotiating: "Agents negotiating now",
  agreed: "Agreed, waiting for the buyer",
  approved: "Approved",
  settled: "Settled",
  no_deal: "No deal",
};

/** Every connection in one list: offers waiting for a yes, what's under way, what's done, and the
 *  listed things still to go with the taker each would go to. The map stays free of lines. */
function Connections({ state, deals, onOpenDeal, onOpenItem }: {
  state: AppState; deals: Deal[]; onOpenDeal: (id: string) => void; onOpenItem?: (id: string) => void;
}) {
  const people = Object.fromEntries(state.participants.map((p) => [p.id, p]));
  const itemById = Object.fromEntries(state.items.map((i) => [i.id, i]));
  const waitingForSeller = (d: Deal) => d.status === "agreed" && !d.seller_accepted;
  const groups: [string, Deal[]][] = [
    ["Waiting for you", deals.filter(waitingForSeller)],
    ["Under way", deals.filter((d) => d.status === "negotiating" || (d.status === "agreed" && d.seller_accepted) || d.status === "approved")],
    ["Done", deals.filter((d) => d.status === "settled")],
  ];
  const toGo = state.items.filter((i) => i.status === "available" && (i.destination_id || i.components.some((c) => c.destination_id)));
  const noDeal = deals.filter((d) => d.status === "no_deal").length;

  const row = (d: Deal) => {
    const its = d.item_ids.map((id) => itemById[id]).filter(Boolean);
    const what = its.map((i) => `${i.count > 1 ? `${i.count} × ` : ""}${i.type}`).join(", ") || "Items";
    const co2 = its.reduce((s, i) => s + (i.co2_avoided_kg ?? 0), 0);
    const price = d.kind === "handover" ? "Free hand-over" : d.final_price_inr ? inr(d.final_price_inr) : "Price being agreed";
    const status = d.kind === "handover" ? "Handed over" : waitingForSeller(d) ? "Your yes needed" : STATUS[d.status];
    return (
      <li key={d.id}>
        <button type="button" className={`conn ${waitingForSeller(d) ? "waiting" : ""} ${d.status === "negotiating" ? "live" : ""}`} onClick={() => onOpenDeal(d.id)}>
          <span className="conn-main">
            <strong>{what.charAt(0).toUpperCase() + what.slice(1)}</strong>
            <span className="small muted">{people[d.seller_id]?.name ?? "Seller"} → {people[d.buyer_id]?.name ?? "Taker"}</span>
          </span>
          <span className="conn-side">
            <span className="conn-price">{price}</span>
            <span className={`status ${d.status === "settled" ? "ok" : ""}`}>{status}</span>
            {co2 > 0 && <span className="small co2">{kg(co2)} CO2e</span>}
          </span>
        </button>
      </li>
    );
  };

  return (
    <section className="connections">
      <h2>Handovers</h2>
      <p className="muted small">Every connection Kintsugi has made: hand-overs, sales and offers from buyers' agents. Tap one for the whole story.</p>
      {groups.map(([title, list]) => list.length > 0 && (
        <div key={title}>
          <h3>{title} <span className="muted small">({list.length})</span></h3>
          <ul className="conn-list">{list.map(row)}</ul>
        </div>
      ))}
      {!deals.length && <p className="muted">Nothing handed over yet. Open an item and choose how it goes: hand it over for free, or sell it to a buyer.</p>}
      {toGo.length > 0 && (
        <>
          <h3>Still to go <span className="muted small">({toGo.length})</span></h3>
          <ul className="conn-list">
            {toGo.slice(0, 20).map((i) => {
              const ids = [...new Set([i.destination_id, ...i.components.map((c) => c.destination_id)].filter(Boolean) as string[])];
              return (
                <li key={i.id}>
                  <button type="button" className="conn" onClick={() => onOpenItem?.(i.id)}>
                    <span className="conn-main">
                      <strong>{i.type.charAt(0).toUpperCase() + i.type.slice(1)}</strong>
                      <span className="small muted">→ {people[ids[0]]?.name ?? "a taker"}{ids.length > 1 ? ` and ${ids.length - 1} more` : ""}</span>
                    </span>
                    <span className="conn-side">
                      {i.next_life && <span className="small">{RUNG_LABEL[i.next_life]}</span>}
                      {i.co2_avoided_kg ? <span className="small co2">{kg(i.co2_avoided_kg)} CO2e</span> : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {noDeal > 0 && <p className="small muted">{noDeal} {noDeal === 1 ? "negotiation" : "negotiations"} ended without a deal; those items are listed again.</p>}
    </section>
  );
}
