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
