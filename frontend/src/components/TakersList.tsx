import type { AppState, GeoPoint, Item } from "../types";
import { TAKER_ROLE, km } from "../labels";

interface Props {
  state: AppState;
  from: GeoPoint;
  item?: Item; // only takers that want this item or its materials; marks the ladder's choice
  radiusKm?: number;
}

/** Who can take things near a place: buyers, dealers, repairers, recyclers, government and compost
 *  units, nearest first, with what each one accepts. */
export default function TakersList({ state, from, item, radiusKm = 15 }: Props) {
  const materials = new Set(item?.components.map((c) => c.material.toLowerCase()) ?? []);
  const chosen = new Set([item?.destination_id, ...(item?.components.map((c) => c.destination_id) ?? [])].filter(Boolean));
  const wants = (p: AppState["participants"][number]) => {
    if (!(p.role in TAKER_ROLE)) return false;
    if (!item) return true;
    if (chosen.has(p.id)) return true;
    if (item.hazards.length) return p.role === "hazard_handler";
    if (p.role === "hazard_handler") return false; // only for suspected hazards
    const type = item.type.toLowerCase();
    return p.accepts_types.some((t) => type.includes(t.toLowerCase()) || t.toLowerCase().includes(type))
      || p.accepts_materials.some((m) => materials.has(m.toLowerCase()));
  };
  const rows = state.participants
    .filter(wants)
    .map((p) => ({ p, d: km(from, p.location) }))
    .filter((r) => r.d <= radiusKm)
    .sort((a, b) => a.d - b.d)
    .slice(0, 12);

  if (!rows.length) return <p className="muted small">No takers within {radiusKm} km yet.</p>;
  return (
    <ul className="takers">
      {rows.map(({ p, d }) => {
        const takes = [...p.accepts_types, ...p.accepts_materials.filter((m) => m !== "any")].slice(0, 4);
        return (
        <li key={p.id} className={chosen.has(p.id) ? "chosen" : ""}>
          <span className="dist">{d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1)} km`}</span>
          <span className="grow">
            <strong>{p.name}</strong>
            <span className="small muted block">
              {TAKER_ROLE[p.role] ?? p.role}
              {takes.length ? ` · takes ${takes.join(", ")}` : p.accepts_materials.includes("any") ? " · takes anything in its licence" : ""}
            </span>
          </span>
          <span className="taker-flags">
            {chosen.has(p.id) && <span className="status ok">Chosen</span>}
            <span className="status">{p.synthetic ? "Sample" : "Google Maps"}</span>
          </span>
        </li>
        );
      })}
    </ul>
  );
}
