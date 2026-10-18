import type { ReactNode } from "react";
import { api } from "../api";
import type { Item } from "../types";
import { sentence } from "../labels";

export interface TrailStop {
  title: string;
  caption: string; // one short line under the title
  done: boolean;
}

// One picture per stop, drawn on a 48px grid in the app's colours (stroke follows the stop's state).
const PICTURES: ReactNode[] = [
  // Scanned: a phone filming
  <g key="scan"><rect x="15" y="8" width="18" height="32" rx="3" /><circle cx="24" cy="21" r="5" /><path d="M21 34h6" /><path d="M7 14v-4h4M41 14v-4h-4M7 34v4h4M41 34v4h-4" /></g>,
  // Checked by a person: a hand with a tick
  <g key="check"><circle cx="24" cy="24" r="14" /><path d="M17 24l5 5 9-10" /></g>,
  // Valued: a price tag
  <g key="value"><path d="M10 24 24 10h13v13L23 37z" /><circle cx="31" cy="16" r="2.5" /><path d="M19 25l5 5" /></g>,
  // Next life chosen: the ladder
  <g key="ladder"><path d="M16 8v32M32 8v32M16 15h16M16 23h16M16 31h16" /></g>,
  // Taker found: a map pin over a street
  <g key="taker"><path d="M24 38s-10-9-10-17a10 10 0 0 1 20 0c0 8-10 17-10 17z" /><circle cx="24" cy="21" r="3.5" /><path d="M8 42h32" /></g>,
  // Handed over: a box moving on
  <g key="handover"><path d="M8 18h18v14H8zM26 22h7l5 5v5H26" /><circle cx="14" cy="35" r="3" /><circle cx="32" cy="35" r="3" /><path d="M12 13l4-4 4 4" /></g>,
  // Impact recorded: a leaf on a seal
  <g key="impact"><circle cx="24" cy="24" r="15" /><path d="M17 29c0-8 6-13 14-13 0 8-5 14-13 14M18 30l7-7" /></g>,
];

const ROW = 112; // px per stop

/**
 * An item's journey drawn as a winding trail, one stop per stage with its own picture: finished
 * stops are filled, the item sits at the stop it has reached, and what's still to come is faded.
 */
export default function JourneyTrail({ item, stops }: { item: Item; stops: TrailStop[] }) {
  const now = stops.findIndex((s) => !s.done);
  const at = now === -1 ? stops.length - 1 : now;
  const x = (i: number) => (i % 2 === 0 ? 24 : 76); // percent across: the trail zigzags
  const y = (i: number) => i * ROW + ROW / 2;
  const height = stops.length * ROW;
  // The trail as one smooth path through every stop; drawn twice: the part travelled, then the rest.
  const seg = (i: number) => `C ${x(i)} ${y(i) + ROW / 2}, ${x(i + 1)} ${y(i + 1) - ROW / 2}, ${x(i + 1)} ${y(i + 1)}`;
  // Green up to the furthest finished stop (stages can finish out of order), dotted after it.
  const reach = Math.max(at, stops.reduce((m, s, i) => (s.done ? i : m), 0));
  const travelled = `M ${x(0)} ${y(0)} ` + stops.slice(0, reach).map((_, i) => seg(i)).join(" ");
  const ahead = `M ${x(reach)} ${y(reach)} ` + stops.slice(reach, -1).map((_, k) => seg(reach + k)).join(" ");
  // The item travels the trail: it sits on the path just before the stop it has reached.
  const marker = at === 0 ? { left: x(0), top: y(0) - ROW / 2 } : { left: 50, top: y(at) - ROW / 2 };
  const photo = item.evidence[0];

  return (
    <div className="trail" style={{ height }} role="list" aria-label="The journey, start to end">
      <svg className="trail-path" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" aria-hidden="true">
        <path d={ahead} className="ahead" vectorEffect="non-scaling-stroke" />
        {at > 0 && <path d={travelled} className="travelled" vectorEffect="non-scaling-stroke" />}
      </svg>
      <span className={`trail-marker ${now === -1 ? "arrived" : ""}`} style={{ left: `${marker.left}%`, top: marker.top }}>
        {photo ? <img src={api.evidenceUrl(photo)} alt="" /> : <b>{sentence(item.type).slice(0, 1)}</b>}
        <span>{now === -1 ? "Arrived" : `Your ${item.type} is here`}</span>
      </span>
      {stops.map((s, i) => {
        const state = s.done ? "done" : i === at ? "now" : "later";
        const left = x(i) < 50;
        return (
          <div key={s.title} role="listitem" className={`stop ${state} ${left ? "left" : "right"}`} style={{ top: y(i) }}>
            <span className="stop-node" style={{ left: `${x(i)}%` }}>
              <svg viewBox="0 0 48 48" width="34" height="34" aria-hidden="true" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                {PICTURES[i]}
              </svg>
              {s.done && <span className="stop-tick" aria-hidden="true">✓</span>}
              <span className="stop-num" aria-hidden="true">{i + 1}</span>
            </span>
            <div className="stop-label">
              <strong>{s.title}</strong>
              <span>{s.caption}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
