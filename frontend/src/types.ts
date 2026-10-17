export type Rung =
  | "reuse"
  | "repair"
  | "upcycle"
  | "harvest_parts"
  | "recycle"
  | "compost"
  | "recover_energy"
  | "safe_disposal";

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface Component {
  name: string;
  material: string;
  est_weight_kg: number;
  next_life: Rung | null;
  destination_id: string | null;
  reason: string;
}

export interface Item {
  id: string;
  site_id: string;
  type: string;
  description: string;
  count: number;
  condition: "A" | "B" | "C" | "D";
  condition_reason: string;
  confidence: number;
  timestamps_s: number[];
  components: Component[];
  hazards: string[];
  needs_verification: boolean;
  tap_test: "solid" | "hollow" | "unknown" | null;
  location: GeoPoint;
  language: string;
  next_life: Rung | null;
  next_life_reason: string;
  destination_id: string | null;
  value_min_inr: number | null;
  value_max_inr: number | null;
  price_sources: string[];
  repair_cost_inr: number | null;
  co2_avoided_kg: number | null;
  recovered_fraction: number | null;
  status: "available" | "in_deal" | "sold" | "routed";
  seller_id: string | null;
  synthetic: boolean;
  verified: boolean;
  has_floor_price: boolean;
  autopilot: boolean;
  evidence: string[];
  take_apart: Record<string, string[]>;
}

export interface Site {
  id: string;
  owner_id: string;
  kind: "home" | "building";
  name: string;
  location: GeoPoint;
}

export interface Participant {
  id: string;
  name: string;
  role: string;
  language: string;
  location: GeoPoint;
  synthetic: boolean;
  accepts_types: string[];
  accepts_materials: string[];
  place_id: string | null;
}

export interface Prediction {
  id: string;
  kind: "supply" | "demand";
  title: string;
  address: string;
  location: GeoPoint;
  expected_date: string;
  expected_materials: string[];
  confidence: number;
  source_language: string;
  source_excerpt: string;
  synthetic: boolean;
}

export interface NegotiationTurn {
  round: number;
  speaker: "seller" | "buyer";
  action: "offer" | "counter" | "final" | "accept" | "decline";
  price_inr: number;
  messages: Record<string, string>;
  guardrail_applied: boolean;
  guardrail_note: string;
}

export interface Deal {
  id: string;
  item_ids: string[];
  seller_id: string;
  buyer_id: string;
  status: "negotiating" | "agreed" | "no_deal" | "approved" | "settled";
  transcript: NegotiationTurn[];
  final_price_inr: number | null;
  settlement: { label: string; payment_mandate: Record<string, unknown> } | null;
  autopilot: boolean;
  created_at: number;
}

export interface Bundle {
  id: string;
  dealer_id: string;
  item_ids: string[];
  route: string[];
  total_value_inr: number;
  total_weight_kg: number;
  status: string;
}

export interface Totals {
  items: number;
  mass_total_kg: number;
  mass_diverted_kg: number;
  material_recovered_kg: number;
  diverted_fraction: number;
  co2_avoided_kg: number;
  value_recovered_inr: number;
  by_rung_kg: Partial<Record<Rung, number>>;
  factor_source: string;
}

export interface StandingRequest {
  id: string;
  buyer_id: string;
  query: string;
  radius_km: number;
  has_cap: boolean; // the highest price itself stays with the buyer's agent
  auto_approve: boolean;
  active: boolean;
  matched_item_ids: string[];
  notified_item_ids: string[];
}

export interface AskReply {
  answer: string;
  answer_en: string;
  language: string;
  action: { type: "none" | "offer_item" | "autopilot_on" | "keep_looking" | "open_item"; item_id?: string; query?: string; label?: string };
  used: { model: string; items: number; takers: number; deals: number; listed_nearby: number };
  heard: Transcript | null;
}

export interface AppState {
  mock_mode: boolean;
  sites: Site[];
  items: Item[];
  participants: Participant[];
  predictions: Prediction[];
  deals: Deal[];
  bundles: Bundle[];
  requests: StandingRequest[];
  totals: Totals;
}

export interface AgentEvent {
  job_id: string;
  agent: string;
  step: string;
  message: string;
  data: Record<string, unknown>;
  ts: number;
}

export interface Job {
  id: string;
  kind: string;
  status: "queued" | "running" | "done" | "error";
  result: Record<string, unknown>;
  error: string | null;
}

export interface SearchResult {
  item: Item;
  score: number;
  distance_km: number | null;
}

export interface DesignResult {
  concept: string;
  lines: { item_id: string; type: string; use: string; quantity: number; unit_price_inr: number | null; cost_inr: number }[];
  total_inr: number;
  render_png_b64: string | null;
  render_prompt: string;
}

export interface Transcript {
  text: string;
  language: string;
  english: string;
  amount_inr?: number;
}
