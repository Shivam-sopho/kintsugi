import { FPS } from "../theme";

// The demo cut: your intro, then your three screen recordings (public/rec/v1..v3.mp4) trimmed to
// your own sentences. Times are seconds in each recording (word timings: public/rec/v<n>.words.json).

/** The opening: the chair clip (public/rec/chair.mp4, filmed upright), then your story with your face
 *  (public/rec/intro.mp4). INTRO_S is both together: keep it at 30 s at most. */
export const CHAIR_S = 10.3;
export const INTRO_S = 28;

/** A part of a recording, in the recording's pixels (3024 × 1964). */
export type Cam = { x: number; y: number; w: number; h: number };
export const REC_W = 3024;
export const REC_H = 1964;

export const CAM = {
  app: { x: 0, y: 300, w: 3024, h: 1530 }, // the whole app: map and panel
  panel: { x: 2150, y: 405, w: 874, h: 1410 }, // the right-hand panel
  modal: { x: 950, y: 430, w: 1124, h: 1400 }, // the hand-over celebration, centred
  cert: { x: 560, y: 380, w: 1900, h: 1450 }, // the certificate page
  ledger: { x: 300, y: 380, w: 2400, h: 1350 }, // the ledger page
} satisfies Record<string, Cam>;

export type Shot = {
  id: string;
  src: "v1" | "v2" | "v3" | "phones" | "certs" | "close";
  from: number; // seconds in the recording (the voice, and the picture unless `vFrom` is set)
  to: number;
  rate?: number; // >1 speeds it up, muted
  vFrom?: number; // show the picture from here instead, keeping the voice from `from`
  vRate?: number; // with vFrom: the picture's speed (below 1 to stretch a short moment under the voice)
  cam?: { at: number; cam: Cam }[]; // at: seconds in the shot's picture, where the camera moves to `cam`
  eyebrow?: string;
  title?: string;
  chip?: string;
  speed?: string;
};

export const SHOTS: Shot[] = [
  { id: "upload", src: "v1", from: 41.9, to: 60, cam: [{ at: 0, cam: CAM.panel }],
    eyebrow: "1 · Show it", title: "Film it, add photos, tell Scout what's going on", chip: "Video and voice, in any language" },
  { id: "scout", src: "v1", from: 60, to: 183.6, rate: 11, cam: [{ at: 0, cam: CAM.panel }],
    eyebrow: "Scout is working", title: "Watching the video and listening to the voice", chip: "Gemini 2.5 Pro · video and audio", speed: "Sped up 11×" },
  { id: "found", src: "v1", from: 183.7, to: 192.2, cam: [{ at: 0, cam: CAM.panel }],
    eyebrow: "Scout found 7 things", title: "Each part gets its own next life", chip: "Rules in code decide · Gemini explains" },
  { id: "decide", src: "v2", from: 15.6, to: 36.7, cam: [{ at: 0, cam: CAM.panel }],
    eyebrow: "2 · The decision", title: "What a heart-shaped cushion can become", chip: "Gemini 2.5 Flash · reuse, repair, recycle, recover" },
  { id: "journey", src: "v2", from: 43.0, to: 48.1, cam: [{ at: 0, cam: CAM.panel }],
    eyebrow: "3 · The journey", title: "Confirm it, and every step of its journey fills in" },
  { id: "handover", src: "v2", from: 53.1, to: 63.0, cam: [{ at: 0, cam: CAM.panel }, { at: 5.2, cam: CAM.modal }],
    eyebrow: "3 · The journey", title: "Hand it over, and see what it saved", chip: "CO2e from DESNZ 2026 emission factors" },
  { id: "certificate", src: "v2", from: 63.0, to: 66.4, vFrom: 67.6, cam: [{ at: 0, cam: CAM.cert }],
    eyebrow: "Impact certificate", title: "A certificate for every hand-over" },
  { id: "a2a", src: "v2", from: 96.1, to: 113.6, cam: [{ at: 0, cam: CAM.panel }],
    eyebrow: "4 · Agent to agent", title: "Two agents negotiate over the A2A protocol", chip: "Each keeps its owner's private limit" },
  { id: "approve", src: "v2", from: 128.0, to: 139.0, cam: [{ at: 0, cam: CAM.panel }, { at: 3.4, cam: CAM.modal }],
    eyebrow: "4 · Agent to agent", title: "A person approves; nothing is sold without a yes" },
  { id: "ledger", src: "v2", from: 139.0, to: 146.6, vFrom: 143.2, cam: [{ at: 0, cam: CAM.ledger }],
    eyebrow: "5 · The ledger", title: "Every hand-over and sale, counted live" },
  { id: "languages", src: "phones", from: 0, to: 20.84,
    eyebrow: "6 · Every language", title: "Hindi on one side, English on the other", chip: "Gemini 2.5 Flash translates each message" },
  { id: "certs", src: "certs", from: 25.16, to: 29.18,
    eyebrow: "6 · Every language", title: "Certificates in English, Hindi and Kannada" },
  { id: "close", src: "close", from: 151.2, to: 156.4 },
];

/** Where each shot's voice comes from (the phones and certificates play your third recording's voice). */
export const voiceOf = (shot: Shot) => (shot.src === "phones" || shot.src === "certs" ? "v3" : shot.src === "close" ? "v2" : shot.src);

export const shotSeconds = (shot: Shot) => (shot.to - shot.from) / (shot.rate ?? 1);
export const frames = (seconds: number) => Math.round(seconds * FPS);

/** Each shot with its start frame on the final timeline (after the intro). */
export const TIMELINE = (() => {
  let at = frames(INTRO_S);
  return SHOTS.map((shot) => {
    const start = at;
    at += frames(shotSeconds(shot));
    return { shot, start, duration: frames(shotSeconds(shot)) };
  });
})();

export const CUT_TOTAL = TIMELINE.at(-1)!.start + TIMELINE.at(-1)!.duration;

// Whisper's mishearings, fixed word by word in the captions.
export const FIXES: [RegExp, string][] = [
  [/\b[Kk]insugi\b|\bkintsugi\b/, "Kintsugi"],
  [/\bcompose\b/, "compost"],
  [/\bgrill\b/, "grille"],
  [/\bcopper\b/, "Copper"],
  [/\bplus\b/, "Plus"],
  [/\b2300\b/, "₹2,300"],
];
