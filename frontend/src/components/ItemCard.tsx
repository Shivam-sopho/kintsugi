import type { Item } from "../types";
import { RUNG_COLOR, RUNG_LABEL, inr, kg } from "../labels";
import { RungIcon } from "./Icons";

interface Props {
  item: Item;
  onOpen: () => void;
  distanceKm?: number | null;
  picked?: boolean;
  onPick?: () => void; // shows a checkbox, for choosing items to negotiate
}

/** One item: what it is, its best next life and what it's worth. Tap to open its passport. */
export default function ItemCard({ item, onOpen, distanceKm, picked, onPick }: Props) {
  const rung = item.next_life;
  const color = rung ? RUNG_COLOR[rung] : "var(--line)";
  return (
    <li className={`item-card ${picked ? "picked" : ""}`} style={{ ["--rung" as string]: color }}>
      {onPick && (
        <input type="checkbox" checked={Boolean(picked)} onChange={onPick} aria-label={`Choose ${item.type}`} />
      )}
      <button type="button" className="item-card-body" onClick={onOpen}>
        <span className="item-card-title">
          {item.type}
          {item.count > 1 && <span className="muted"> × {item.count}</span>}
        </span>
        <span className="item-card-meta">
          <span className="rung-pill">{rung && <RungIcon rung={rung} />}{rung ? RUNG_LABEL[rung] : "Not decided"}</span>
          {item.value_max_inr != null && <span>{inr(item.value_min_inr)}–{inr(item.value_max_inr)}</span>}
          {item.co2_avoided_kg ? <span className="co2">{kg(item.co2_avoided_kg)} CO2e saved</span> : null}
          {distanceKm != null && <span>{distanceKm} km away</span>}
        </span>
        <span className="item-card-flags">
          {item.hazards.length > 0 && <span className="status hazard">Hazard</span>}
          {item.verified && <span className="status ok">Confirmed</span>}
          {item.status !== "available" && <span className="status">{item.status.replace("_", " ")}</span>}
          {item.synthetic && <span className="status">Sample data</span>}
        </span>
      </button>
    </li>
  );
}
