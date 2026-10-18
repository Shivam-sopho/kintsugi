import { s } from "./theme";

// The script's timeline (docs/video/script.md): eight scenes, 3:00 in all.
export const SCENES = [
  { id: "S1Planet", title: "From the planet to my chair", from: 0, seconds: 30 },
  { id: "S2Scan", title: "Rewind: I scan the chair", from: 30, seconds: 30 },
  { id: "S3Map", title: "The map", from: 60, seconds: 14 },
  { id: "S4Ananya", title: "Ananya finds my chair", from: 74, seconds: 12 },
  { id: "S5Deal", title: "The deal room", from: 86, seconds: 42 },
  { id: "S6Ledger", title: "The ledger", from: 128, seconds: 18 },
  { id: "S7Hood", title: "Under the hood", from: 146, seconds: 20 },
  { id: "S8Close", title: "Payoff and close", from: 166, seconds: 14 },
] as const;

export const TOTAL = s(180);
