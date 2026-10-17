import { api } from "../api";
import type { AppState, Item } from "../types";
import { LANG_LABEL, inr, kg } from "../labels";
import { PERSONA_ROLES } from "../persona";
import ItemCard from "./ItemCard";

const ROLE_LABEL: Record<string, string> = {
  homeowner: "Homeowner", dealer: "Scrap dealer", buyer: "Buyer", ngo: "Charity", repairer: "Repairer",
  upcycler: "Upcycler", recycler: "Recycler",
};
const DEAL_STATUS: Record<string, string> = {
  negotiating: "Agents negotiating", agreed: "Agreed, waiting for approval", approved: "Approved",
  settled: "Settled", no_deal: "No deal",
};

const itemKg = (i: Item) => i.components.reduce((s, c) => s + c.est_weight_kg, 0) * Math.max(i.count, 1);

interface Props {
  state: AppState;
  personaId: string;
  onChangePersona: (id: string) => void;
  onOpenItem: (id: string) => void;
}

/** One person's history: what they listed, what they bought and sold, and the carbon it saved. */
export default function ProfilePanel({ state, personaId, onChangePersona, onOpenItem }: Props) {
  const people = state.participants.filter((p) => PERSONA_ROLES.has(p.role) && p.synthetic);
  const me = state.participants.find((p) => p.id === personaId);
  const byId = Object.fromEntries(state.participants.map((p) => [p.id, p]));
  const items = state.items.filter((i) => i.seller_id === personaId);
  const deals = [...state.deals].filter((d) => d.seller_id === personaId || d.buyer_id === personaId).sort((a, b) => b.created_at - a.created_at);
  const settled = deals.filter((d) => d.status === "settled");
  const settledItems = settled.flatMap((d) => d.item_ids).map((id) => state.items.find((i) => i.id === id)).filter(Boolean) as Item[];

  const listedKg = items.reduce((s, i) => s + itemKg(i), 0);
  const potentialCo2 = items.filter((i) => i.status === "available").reduce((s, i) => s + (i.co2_avoided_kg ?? 0), 0);
  const recordedCo2 = settledItems.reduce((s, i) => s + (i.co2_avoided_kg ?? 0), 0);
  const earned = settled.filter((d) => d.seller_id === personaId).reduce((s, d) => s + (d.final_price_inr ?? 0), 0);
  const spent = settled.filter((d) => d.buyer_id === personaId).reduce((s, d) => s + (d.final_price_inr ?? 0), 0);

  return (
    <section className="profile">
      <div className="profile-head">
        <span className="avatar big" aria-hidden="true">{(me?.name ?? "?").slice(0, 1)}</span>
        <div className="grow">
          <h2>{me?.name ?? personaId}</h2>
          <p className="muted small">
            {me ? `${ROLE_LABEL[me.role] ?? me.role}, speaks ${LANG_LABEL[me.language] ?? me.language}` : ""}
            {me?.synthetic && me.id !== "ppl_me" ? ". Sample person" : ""}
          </p>
        </div>
      </div>
      <label>
        Use Kintsugi as
        <select value={personaId} onChange={(e) => onChangePersona(e.target.value)}>
          {people.map((p) => <option key={p.id} value={p.id}>{p.name}, {ROLE_LABEL[p.role] ?? p.role}</option>)}
        </select>
      </label>
      <p className="small muted">Scans are listed as this person, and deals are made as them. There are no accounts in this prototype.</p>

      <div className="stat-grid">
        <div><span className="num">{kg(listedKg)}</span><span className="lbl">listed for a next life</span></div>
        <div><span className="num">{kg(potentialCo2)}</span><span className="lbl">CO2e that can be avoided when these reach their next life</span></div>
        <div><span className="num">{kg(recordedCo2)}</span><span className="lbl">CO2e avoided, recorded from settled deals</span></div>
        <div><span className="num">{inr(earned || spent)}</span><span className="lbl">{spent && !earned ? "spent on reclaimed items" : "earned from sales"}</span></div>
      </div>

      <h3>Items listed ({items.length})</h3>
      {items.length ? (
        <ul className="cards">{items.map((i) => <ItemCard key={i.id} item={i} onOpen={() => onOpenItem(i.id)} />)}</ul>
      ) : (
        <p className="muted small">Nothing listed yet. Scan something on Home.</p>
      )}

      {state.requests.some((r) => r.buyer_id === personaId && r.active) && (
        <>
          <h3>Standing requests</h3>
          <ul className="history">
            {state.requests.filter((r) => r.buyer_id === personaId && r.active).map((r) => (
              <li key={r.id}>
                <strong>{r.query}</strong>
                <span className="small muted">
                  Within {r.radius_km} km{r.auto_approve ? ", approves automatically within a private limit" : ""}.{" "}
                  {r.matched_item_ids.length} negotiated, {r.notified_item_ids.length} other matches.
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <h3>Deals ({deals.length})</h3>
      {deals.length ? (
        <ul className="history">
          {deals.map((d) => {
            const selling = d.seller_id === personaId;
            const other = byId[selling ? d.buyer_id : d.seller_id];
            const what = d.item_ids.map((id) => state.items.find((i) => i.id === id)?.type).filter(Boolean).join(", ");
            return (
              <li key={d.id}>
                <div className="row between">
                  <strong>{selling ? "Sold" : "Bought"} {what || "items"}{d.autopilot && <span className="status autopilot">Autopilot</span>}</strong>
                  <span>{inr(d.final_price_inr)}</span>
                </div>
                <span className="small muted">
                  {selling ? "to" : "from"} {other?.name ?? "someone"} · {DEAL_STATUS[d.status] ?? d.status}
                </span>
                {d.status === "settled" && (
                  <a className="small" href={api.certificateUrl(d.id, me?.language)} target="_blank" rel="noreferrer">Impact certificate</a>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="muted small">No deals yet.</p>
      )}
    </section>
  );
}
