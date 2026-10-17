import type { Rung } from "./types";

export const RUNG_ORDER: Rung[] = [
  "reuse",
  "repair",
  "upcycle",
  "harvest_parts",
  "recycle",
  "recover_energy",
  "safe_disposal",
];

export const RUNG_LABEL: Record<Rung, string> = {
  reuse: "Reuse",
  repair: "Repair",
  upcycle: "Upcycle",
  harvest_parts: "Harvest parts",
  recycle: "Recycle",
  recover_energy: "Recover energy",
  safe_disposal: "Safe disposal",
};

// Gold for the top of the ladder fading to stone at the bottom: the ladder is a sequence.
export const RUNG_COLOR: Record<Rung, string> = {
  reuse: "#8A6514",
  repair: "#A27A22",
  upcycle: "#B8892B",
  harvest_parts: "#5E8E7A",
  recycle: "#6E9E8A",
  recover_energy: "#8C939E",
  safe_disposal: "#B1B5BC",
};

export const AGENT_LABEL: Record<string, string> = {
  system: "Kintsugi",
  oracle: "Oracle",
  scout: "Scout",
  architect: "Architect",
  market: "Market",
  seller: "Seller agent",
  buyer: "Buyer agent",
  bundler: "Bundler",
  ledger: "Ledger",
};

export const LANG_LABEL: Record<string, string> = {
  en: "English",
  hi: "Hindi",
  kn: "Kannada",
  ta: "Tamil",
  id: "Bahasa",
  ja: "Japanese",
};

export const inr = (n: number | null | undefined) =>
  n == null ? "–" : `₹${Math.round(n).toLocaleString("en-IN")}`;

export const kg = (n: number | null | undefined) =>
  n == null ? "–" : `${n >= 100 ? Math.round(n).toLocaleString("en-IN") : n.toFixed(1)} kg`;

export const DEMO_CENTER = { lat: 12.95, lng: 77.63 }; // Bengaluru

// What Kintsugi says out loud after a scan or a search. Written in English; the API reads it in the
// person's language. Short, so it's quick to hear.
export function scanSummary(items: import("./types").Item[]): string {
  if (!items.length) return "Scout couldn't list anything this time. Try again closer up, in good light.";
  const lines = items.slice(0, 3).map((i) => {
    const life = i.next_life ? `best next life: ${RUNG_LABEL[i.next_life].toLowerCase()}` : "next life not decided yet";
    return `${i.type}, ${life}${i.value_max_inr ? `, worth up to ${inr(i.value_max_inr)}` : ""}`;
  });
  const hazard = items.find((i) => i.hazards.length);
  return [
    `Scout found ${items.length} ${items.length === 1 ? "item" : "items"}.`,
    ...lines.map((l) => `${l}.`),
    hazard ? `The ${hazard.type} may be hazardous, so it goes to a licensed handler for testing.` : "",
    "Tap an item to see where it can go.",
  ].filter(Boolean).join(" ");
}

export function searchSummary(results: import("./types").SearchResult[]): string {
  if (!results.length) return "Nothing nearby matches yet. Try other words, or search with a photo.";
  const best = results[0];
  const where = best.distance_km != null ? `, ${best.distance_km} kilometres away` : "";
  const price = best.item.value_max_inr ? `, about ${inr(best.item.value_max_inr)} each` : "";
  const n = results.length;
  return `I found ${n} ${n === 1 ? "match" : "matches"} nearby. The best is ${best.item.type}${where}${price}. Choose the ones you want and the agents will negotiate for you.`;
}
