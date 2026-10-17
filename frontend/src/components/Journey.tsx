import type { AppState, Item } from "../types";
import { RUNG_LABEL } from "../labels";

interface Step {
  label: string;
  done: boolean;
}

/** Where an item is on its way to a next life, and the one thing that happens next. */
export function journey(item: Item, state: AppState): { steps: Step[]; next: string } {
  const people = Object.fromEntries(state.participants.map((p) => [p.id, p]));
  const deal = state.deals.find((d) => d.item_ids.includes(item.id) && d.status !== "no_deal");
  const taker = item.destination_id ? people[item.destination_id] : undefined;
  const partTakers = new Set(item.components.map((c) => c.destination_id).filter(Boolean));
  const hasTaker = Boolean(taker) || partTakers.size > 0;
  const finished = item.status === "sold" || item.status === "routed" || deal?.status === "settled";

  const steps: Step[] = [
    { label: "Scanned", done: true },
    { label: "Checked", done: item.verified },
    { label: "Valued", done: item.value_max_inr != null || item.hazards.length > 0 },
    { label: "Next life chosen", done: item.next_life != null },
    { label: "Taker found", done: hasTaker },
    { label: item.hazards.length ? "Handed over" : "Deal or pickup", done: Boolean(deal) || finished },
    { label: "Impact recorded", done: finished },
  ];

  let next: string;
  if (finished) next = "Done. It has its next life, and the kilograms and CO2e saved are recorded.";
  else if (item.hazards.length)
    next = taker ? `A licensed handler, ${taker.name}, collects it for professional testing. It is never reused.`
      : "It needs a licensed handler for professional testing. It is never reused.";
  else if (deal?.status === "agreed") next = "A price is agreed. It settles once the buyer approves: see Deals.";
  else if (deal) next = "The agents are negotiating right now: see Deals.";
  else if (!item.verified) next = "Check what Scout saw below, then tap Looks right or Correct it.";
  else if (taker && ["buyer", "ngo", "dealer"].includes(taker.role))
    next = item.autopilot ? `Your agent is ready to sell to matching buyers, starting with ${taker.name}.`
      : `Offer it to ${taker.name}, or set your lowest price and let your agent sell it.`;
  else if (hasTaker)
    next = `Its parts go to ${partTakers.size} nearby ${partTakers.size === 1 ? "taker" : "takers"} for ${item.next_life ? RUNG_LABEL[item.next_life].toLowerCase() : "a next life"}; a dealer pickup is arranged when there's enough nearby.`;
  else next = "No taker nearby yet. Kintsugi keeps looking, and tells you when one appears.";
  return { steps, next };
}

export default function Journey({ item, state }: { item: Item; state: AppState }) {
  const { steps, next } = journey(item, state);
  const current = steps.findIndex((s) => !s.done);
  return (
    <section className="journey" aria-label="Journey to its next life">
      <ol>
        {steps.map((s, i) => (
          <li key={s.label} className={s.done ? "done" : i === current ? "now" : ""}>
            <span className="dot" aria-hidden="true" />
            <span className="label">{s.label}</span>
          </li>
        ))}
      </ol>
      <p className="journey-next"><strong>Next:</strong> {next}</p>
    </section>
  );
}
