import type { Rung } from "../types";

/** The Kintsugi mark: three recycling arrows chasing each other, with a gold kintsugi seam where
 *  the loop was mended. Green and gold come from the design tokens. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" className="logo">
      <path d={LOOP_ARCS} fill="none" stroke="var(--celadon)" strokeWidth="4" strokeLinecap="round" />
      <path d={LOOP_HEADS} fill="var(--celadon)" />
      <path d={SEAM} fill="none" stroke="var(--gold)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
const LOOP_ARCS = "M26.4 10.2A14 14 0 0 1 37.7 26.9M34.7 33.0A14 14 0 0 1 14.6 34.4M10.8 28.8A14 14 0 0 1 19.7 10.7";
const LOOP_HEADS = "M42.1 27.8L36.6 32.3L33.3 26.0z M11.6 37.7L10.5 30.7L17.6 31.1z M18.3 6.4L24.9 9.0L21.1 15.0z";
const SEAM = "M23.4 12.5 21.6 17.8l3.4 3.6-2.3 4.4 1.9 3.2";

// One line icon per next life (24px grid). Recycle uses the mark's arrows.
const RUNG_PATH: Record<Rung, string> = {
  reuse: "M4 12a8 8 0 0 1 13.7-5.6M20 12a8 8 0 0 1-13.7 5.6M18 3v4h-4M6 21v-4h4",
  repair: "M14.7 6.3a4 4 0 0 0-5.4 5.4L3.5 17.5l3 3 5.8-5.8a4 4 0 0 0 5.4-5.4l-2.4 2.4-2.6-.4-.4-2.6z",
  upcycle: "M12 19V5M6 11l6-6 6 6M5 21h14",
  harvest_parts: "M4 4h7v7H4zM13 4h7v7h-7zM13 13h7v7h-7zM7.5 14v6M4.5 17h6",
  recycle: "M6.4 15.3A6.5 6.5 0 0 1 15.3 6.4M17.6 8.7a6.5 6.5 0 0 1-8.9 8.9M15.3 3.5l.9 3.2-3.2.7M8.7 20.5l-.9-3.2 3.2-.7",
  compost: "M5 19c0-8 6-13 14-14-1 8-6 14-14 14zM5 19l7-7",
  recover_energy: "M13 3 5 14h6l-1 7 8-11h-6z",
  safe_disposal: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4",
};

export function RungIcon({ rung, size = 14 }: { rung: Rung; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className="rung-icon"
         fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={RUNG_PATH[rung]} />
    </svg>
  );
}
