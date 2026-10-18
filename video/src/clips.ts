import { getStaticFiles } from "remotion";

export type Kind = "REAL" | "SCREEN" | "AI" | "STOCK" | "MOTION";

/** Every clip in the shot list: what it is, so a placeholder can say exactly what to film. */
export const CLIPS: Record<string, { kind: Kind; what: string; how?: string; ai?: boolean }> = {
  "01a_landfill_aerial.mp4": { kind: "STOCK", what: "Aerial rising over a landfill", how: "6 s. Pexels 'landfill aerial', or Veo (prompt in the script)" },
  "01b_street_dump.mp4": { kind: "REAL", what: "Furniture and rubble dumped on a Bengaluru street", how: "Steady, 3 s" },
  "01c_room_working.mp4": { kind: "REAL", what: "Me on the wooden chair, working on the laptop", how: "Side angle, natural light, 4 s" },
  "01d_chair_breaks.mp4": { kind: "REAL", what: "The leg gives way; I catch myself, stand and look at it", how: "Record the real sound" },
  "01e_search_phone.mp4": { kind: "REAL", what: "I search 'how to dispose of a broken chair', scroll, frown", how: "Close-up over the shoulder" },
  "01f_drag_to_bin.mp4": { kind: "REAL", what: "I drag the chair out and leave it by the bin", how: "Low angle, 4 s" },
  "01g_chair_landfill.mp4": { kind: "AI", what: "The same kind of chair tumbling onto a landfill, camera pulling up", how: "5 s, Veo (prompt in the script)", ai: true },
  "02a_home.mp4": { kind: "SCREEN", what: "Kintsugi Home on my phone", how: "scrcpy, 3 s" },
  "02b_film_chair.mp4": { kind: "REAL", what: "Me filming the chair, speaking Hindi", how: "Second phone over my shoulder; record the voice" },
  "02c_live_scan.mp4": { kind: "SCREEN", what: "The live scan card, steps ticking off", how: "scrcpy, full length (sped up 2×)" },
  "02d_passport.mp4": { kind: "SCREEN", what: "The passport, slowly scrolled, with the spoken answer", how: "scrcpy with audio" },
  "03a_takers.mp4": { kind: "SCREEN", what: "Who can take it, nearest first", how: "Slow scrolling" },
  "03b_map_zoom.mp4": { kind: "SCREEN", what: "Pinch out from my pin to the whole city", how: "One smooth move, 6 s" },
  "03c_oracle_notice.mp4": { kind: "SCREEN", what: "A Kannada notice is uploaded; a ring appears" },
  "04a_ananya_asks.mp4": { kind: "REAL", what: "Ananya closes the shop page and asks for wooden chairs", how: "Over the shoulder, then her face" },
  "04b_search_result.mp4": { kind: "SCREEN", what: "Search results with my chair near the top" },
  "04c_design_render.mp4": { kind: "SCREEN", what: "Architect's café render", how: "3 s" },
  "05a_two_phones_wide.mp4": { kind: "REAL", what: "Two phones side by side on a table", how: "Top-down or 45°, 15 s" },
  "05b_deal_hi.mp4": { kind: "SCREEN", what: "My phone: the negotiation in Hindi" },
  "05c_deal_en.mp4": { kind: "SCREEN", what: "Ananya's phone: the same negotiation in English" },
  "05d_approve.mp4": { kind: "SCREEN", what: "Thumb taps Approve; the celebration plays", how: "Close-up plus scrcpy" },
  "06a_ledger.mp4": { kind: "SCREEN", what: "The ledger and 'How it's counted'", how: "Laptop" },
  "06b_certificate.mp4": { kind: "SCREEN", what: "Certificate in English, Hindi and Kannada", how: "Laptop" },
  "07_run_demo.mp4": { kind: "SCREEN", what: "Run demo story on the live site", how: "Laptop, 10 s" },
  "08a_chair_in_cafe.mp4": { kind: "REAL", what: "The same chair, leg fixed, in the café; Ananya sits with a coffee", how: "Warm light, slow push-in, 6 s" },
  "08b_city_picker.mp4": { kind: "SCREEN", what: "City picker cycling through Singapore, Tokyo, Jakarta, Bangkok" },
};

/** Whether a file is in public/ (clips go in public/clips/, audio in public/audio/). */
export function has(path: string): boolean {
  return getStaticFiles().some((f) => f.name === path);
}
