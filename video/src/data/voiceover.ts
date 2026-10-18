import type { Caption } from "@remotion/captions";

/**
 * The voiceover from docs/video/script.md, line by line, placed on the 3:00 timeline (seconds).
 * Until public/voiceover.wav is transcribed (npm run captions:voice), captions are spread evenly
 * over these lines; after that, whisper.cpp's word timings are used instead.
 */
export const VOICE: { start: number; end: number; text: string }[] = [
  // 1. From the planet to my chair
  { start: 0.5, end: 7.6, text: "Every year, the world throws away two billion tonnes of waste. By 2050, it'll be almost four billion. Most of it ends up here." },
  { start: 8.2, end: 10.2, text: "This is my chair. Yesterday, it broke." },
  { start: 12.6, end: 19.6, text: "I didn't know who could repair it, who'd want the wood, or where it was supposed to go. So I did what everyone does." },
  { start: 20.2, end: 24.6, text: "And it would have ended up there. Along with everything else nobody knew what to do with." },
  { start: 25.0, end: 29.8, text: "So let's rewind. In Japan, broken things are repaired with gold. This is Kintsugi: Google Maps for the circular economy." },
  // 2. Rewind: I scan the chair
  { start: 30.5, end: 33.0, text: "This time, I just film it and talk, in Hindi." },
  { start: 37.5, end: 59.5, text: "Gemini watches and listens. It lists every part and material, and prices the chair with Google Search, citing its sources. Then code, not the model, picks the best next life. A new leg costs far less than a new chair, so it should be used again." },
  // 3. The map
  { start: 60.3, end: 73.8, text: "Now I can see exactly who can take it, nearest first. Zoom out, and the city becomes a map of everything reusable, even what's still to come: Oracle reads demolition notices in Kannada and Hindi, weeks before anything is thrown away." },
  // 4. Ananya finds my chair
  { start: 74.3, end: 77.6, text: "Three kilometres away, Ananya was about to buy new chairs for her café." },
  { start: 79.8, end: 85.9, text: "She asks in English, and Gemini Embedding 2 finds my chair, though I described it in Hindi. Architect can even design her whole café from reclaimed things nearby." },
  // 5. The deal room
  { start: 86.5, end: 99.5, text: "Now the hard part: bargaining across languages without giving away your limit. My agent speaks Hindi. Ananya's agent speaks English. They negotiate with each other over Google's A2A protocol." },
  { start: 105.5, end: 126.0, text: "Each person's limit stays private, and code stops either agent from crossing it. Nothing is sold until a person taps approve. Or switch on Autopilot, and your agent sells within your limit while you get on with your day." },
  // 6. The ledger
  { start: 128.4, end: 145.5, text: "Every hand-over is recorded: the kilograms kept out of landfill and the carbon avoided, counted conservatively from UK Government emission factors, and every figure shows how it was counted. I get a certificate in Hindi." },
  // 7. Under the hood
  { start: 146.3, end: 148.6, text: "Under the hood: five agents." },
  { start: 148.8, end: 151.2, text: "Gemini 2.5 Pro sees and reads." },
  { start: 151.4, end: 154.6, text: "Flash prices with Google Search and negotiates." },
  { start: 154.8, end: 156.3, text: "Flash Image draws." },
  { start: 156.5, end: 158.8, text: "Flash TTS speaks ten languages." },
  { start: 159.0, end: 161.0, text: "Embedding 2 connects it all." },
  { start: 161.2, end: 165.6, text: "It runs on Cloud Run, Firestore and Google Maps, and it's live today." },
  // 8. Payoff and close
  { start: 166.3, end: 168.8, text: "My chair never reached the landfill." },
  { start: 169.0, end: 174.2, text: "Now imagine every chair, every door, every building, in every city in Asia-Pacific." },
  { start: 174.5, end: 178.8, text: "Point your phone at anything. Kintsugi finds its next life." },
];

/** Lines spoken in the clips themselves (natural sound), subtitled. Update the agent line once recorded. */
export const SUBTITLES: { start: number; end: number; original?: string; english: string }[] = [
  { start: 33.2, end: 37.3, original: "इस कुर्सी का एक पैर टूट गया है। लकड़ी सागौन की है।", english: "One leg of this chair is broken. The wood is teak." },
  { start: 77.7, end: 79.7, english: "“I need wooden chairs for my café.”" },
  { start: 100.0, end: 105.0, original: "(the Hindi agent line, as recorded)", english: "(its English subtitle: replace with the real line)" },
];

/** Captions spread evenly over each line's words (used until the real voiceover is transcribed). */
export function scriptCaptions(): Caption[] {
  const out: Caption[] = [];
  for (const line of VOICE) {
    const words = line.text.split(/\s+/);
    const per = ((line.end - line.start) * 1000) / words.length;
    words.forEach((w, i) => {
      const startMs = Math.round(line.start * 1000 + i * per);
      out.push({ text: (out.length === 0 ? "" : " ") + w, startMs, endMs: Math.round(startMs + per), timestampMs: startMs, confidence: null });
    });
  }
  return out;
}

/** When a word is first said at or after `afterSec` (for lighting up the diagram on the spoken word). */
export function whenSaid(captions: Caption[], word: string, afterSec: number, fallbackSec: number): number {
  const w = word.toLowerCase();
  const hit = captions.find((c) => c.startMs >= afterSec * 1000 && c.text.trim().toLowerCase().replace(/[^a-z0-9]/g, "") === w);
  return hit ? hit.startMs / 1000 : fallbackSec;
}
