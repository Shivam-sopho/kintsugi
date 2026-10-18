import { FPS } from "../theme";

// The demo cut: the problem, then your three screen recordings (public/rec/v1..v3.mp4) trimmed to
// your own sentences. Times are seconds in each recording (word timings: public/rec/v<n>.words.json).

/** Your voice, and the recording under it, play this much faster. */
export const VOICE_RATE = 1.25;

/** The opening, before the demo: what each part is and how long it lasts. Your story voice, with your
 *  face in a circle (public/rec/intro.mp4), plays over all of it: keep it to OPEN_S. */
export const OPEN = [
  { id: "landfill", seconds: 5 }, // Veo landfill with the UNEP figures
  { id: "problem", seconds: 6.5 }, // your problem slide (public/rec/problem.png)
  { id: "chair", seconds: 10.33 / VOICE_RATE }, // the chair clip (public/rec/chair.mp4), with the story in captions
  { id: "dump", seconds: 3 }, // where it ends up
  { id: "logo", seconds: 7 }, // Kintsugi, and Gemini at every step
] as const;

/** The opening's captions: your script. Read each line while it's on screen (seconds into its part). */
export const SCRIPT: Record<(typeof OPEN)[number]["id"], { at: number; text: string }[]> = {
  landfill: [{ at: 0, text: "The world throws away 2.1 billion tonnes of waste a year, 3.8 billion by 2050." }],
  problem: [{ at: 0, text: "Useful things are dumped because nobody knows who needs them." }],
  chair: [
    { at: 0, text: "Take my broken chair: steel, foam and fabric, all still useful." },
    { at: 4.1, text: "But it's worth too little to sell, price and arrange a pickup for." },
  ],
  dump: [{ at: 0, text: "So it goes in the bin, and ends up here." }],
  logo: [
    { at: 0, text: "So we built Kintsugi, Google Maps for the circular economy." },
    { at: 3.2, text: "Gemini powers every step: it sees, decides, explains, translates and negotiates." },
  ],
};
export const OPEN_S = OPEN.reduce((a, o) => a + o.seconds, 0);

/** A part of a recording, in the recording's pixels (3024 × 1964). */
export type Cam = { x: number; y: number; w: number; h: number };
export const REC_W = 3024;
export const REC_H = 1964;

export const CAM = {
  wide: { x: 600, y: 405, w: 2424, h: 1425 }, // the app: the map's right half and the whole panel
  focus: { x: 840, y: 520, w: 1900, h: 1117 }, // a push in on the hand-over card, centred
  cert: { x: 560, y: 380, w: 1900, h: 1450 }, // the certificate page
  ledger: { x: 300, y: 380, w: 2400, h: 1350 }, // the ledger page
} satisfies Record<string, Cam>;

export type Shot = {
  id: string;
  src: "v1" | "v2" | "v3" | "phones" | "certs" | "close";
  from: number; // seconds in the recording (the voice, and the picture unless `vFrom` is set)
  to: number;
  rate?: number; // playback speed; VOICE_RATE unless set
  muted?: boolean; // no voice (a sped-up wait)
  vFrom?: number; // show the picture from here instead, keeping the voice from `from`
  vRate?: number; // with vFrom: the picture's speed (to stretch or squeeze a moment under the voice)
  cam?: { at: number; cam: Cam }[]; // at: seconds into the shot's picture (recording time), where the camera moves to `cam`
  eyebrow?: string;
  title?: string;
  chip?: string;
  speed?: string;
};

export const SHOTS: Shot[] = [
  { id: "upload", src: "v1", from: 41.9, to: 60, cam: [{ at: 0, cam: CAM.wide }],
    eyebrow: "1 · Show it", title: "Film it, add photos, tell Scout", chip: "Video and voice, any language" },
  { id: "scout", src: "v1", from: 60, to: 183.6, rate: 11, muted: true, cam: [{ at: 0, cam: CAM.wide }],
    eyebrow: "Scout is working", title: "Watching the video, listening to the voice", chip: "Gemini 2.5 Pro", speed: "Sped up 11×" },
  { id: "found", src: "v1", from: 183.7, to: 192.2, cam: [{ at: 0, cam: CAM.wide }],
    eyebrow: "Scout found 7 things", title: "Each part gets its own next life", chip: "Rules decide · Gemini explains" },
  { id: "decide", src: "v2", from: 15.6, to: 36.7, cam: [{ at: 0, cam: CAM.wide }],
    eyebrow: "2 · The decision", title: "What a heart-shaped cushion can become", chip: "Gemini 2.5 Flash" },
  { id: "journey", src: "v2", from: 43.0, to: 48.1, cam: [{ at: 0, cam: CAM.wide }],
    eyebrow: "3 · The journey", title: "Confirm it, and every step fills in" },
  { id: "handover", src: "v2", from: 53.1, to: 63.0, cam: [{ at: 0, cam: CAM.wide }, { at: 5.2, cam: CAM.focus }],
    eyebrow: "3 · The journey", title: "Hand it over, and see what it saved", chip: "DESNZ 2026 emission factors" },
  { id: "certificate", src: "v2", from: 63.0, to: 66.4, vFrom: 67.6, cam: [{ at: 0, cam: CAM.cert }],
    eyebrow: "Impact certificate", title: "A certificate for every hand-over" },
  { id: "a2a", src: "v2", from: 96.1, to: 113.6, cam: [{ at: 0, cam: CAM.wide }],
    eyebrow: "4 · Agent to agent", title: "Two agents negotiate over A2A", chip: "Each keeps its owner's private limit" },
  { id: "approve", src: "v2", from: 128.0, to: 139.0, cam: [{ at: 0, cam: CAM.wide }, { at: 3.4, cam: CAM.focus }],
    eyebrow: "4 · Agent to agent", title: "A person approves: nothing is sold without a yes" },
  { id: "ledger", src: "v2", from: 139.0, to: 146.6, vFrom: 143.2, cam: [{ at: 0, cam: CAM.ledger }],
    eyebrow: "5 · The ledger", title: "Every hand-over and sale, counted live" },
  { id: "languages", src: "phones", from: 0, to: 20.84,
    eyebrow: "6 · Every language", title: "Hindi on one side, English on the other", chip: "Gemini 2.5 Flash translates each message" },
  { id: "certs", src: "certs", from: 25.16, to: 29.18,
    eyebrow: "6 · Every language", title: "Certificates in English, Hindi and Kannada" },
  { id: "close", src: "close", from: 151.2, to: 155.4 },
];

/** Where each shot's voice comes from (the phones and certificates play your third recording's voice). */
export const voiceOf = (shot: Shot) => (shot.src === "phones" || shot.src === "certs" ? "v3" : shot.src === "close" ? "v2" : shot.src);

export const rateOf = (shot: Shot) => shot.rate ?? VOICE_RATE;
export const shotSeconds = (shot: Shot) => (shot.to - shot.from) / rateOf(shot);
export const frames = (seconds: number) => Math.round(seconds * FPS);

/** Each shot with its start frame on the final timeline (after the opening). */
export const TIMELINE = (() => {
  let at = frames(OPEN_S);
  return SHOTS.map((shot) => {
    const start = at;
    at += frames(shotSeconds(shot));
    return { shot, start, duration: frames(shotSeconds(shot)) };
  });
})();

export const CUT_TOTAL = TIMELINE.at(-1)!.start + TIMELINE.at(-1)!.duration + frames(1);

// Whisper's mishearings, fixed word by word in the captions.
export const FIXES: [RegExp, string][] = [
  [/\b[Kk]insugi\b|\bkintsugi\b/, "Kintsugi"],
  [/\bcompose\b/, "compost"],
  [/\bgrill\b/, "grille"],
  [/\bcopper\b/, "Copper"],
  [/\bplus\b/, "Plus"],
  [/\b2300\b/, "₹2,300"],
];
