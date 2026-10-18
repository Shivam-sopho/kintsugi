import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { AbsoluteFill, Audio, Easing, Img, OffthreadVideo, Sequence, continueRender, delayRender, interpolate, staticFile, useCurrentFrame } from "remotion";
import { createTikTokStyleCaptions, type Caption } from "@remotion/captions";
import { C, FONT_SANS, FPS, W } from "../theme";
import { CLIPS, has } from "../clips";
import { Badge, Footage, Logo, PhoneFrame, Source, Stage, Title, useIn } from "../components/ui";
import { CUT_TOTAL, FIXES, OPEN, OPEN_S, SCRIPT, REC_H, REC_W, TIMELINE, VOICE_RATE, frames, rateOf, voiceOf, type Cam, type Shot } from "./edl";

type Box = { x: number; y: number; w: number; h: number };
const MOVE_S = 0.7; // how long a camera move takes
const CAPTION_BAND = 115; // the strip under the video where the captions go, so they never cover it

/** Where a part of the recording sits on screen: as large as fits above the caption band. */
function boxOf(cam: Cam): Box {
  const k = Math.min(1840 / cam.w, (1080 - CAPTION_BAND - 15) / cam.h);
  return { x: (W - cam.w * k) / 2, y: 15, w: cam.w * k, h: cam.h * k };
}

const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
function mix<T extends Record<string, number>>(a: T, b: T, p: number): T {
  return Object.fromEntries(Object.keys(a).map((k) => [k, lerp(a[k], b[k], p)])) as T;
}

/** The camera at `t` seconds into a shot's picture (recording time). */
function cameraAt(shot: Shot, t: number): { crop: Cam; box: Box } {
  const keys = shot.cam ?? [];
  let i = 0;
  while (i + 1 < keys.length && keys[i + 1].at <= t) i++;
  if (i === 0) return { crop: keys[0].cam, box: boxOf(keys[0].cam) };
  const p = Easing.inOut(Easing.cubic)(Math.min(1, Math.max(0, (t - keys[i].at) / MOVE_S)));
  return { crop: mix(keys[i - 1].cam, keys[i].cam, p), box: mix(boxOf(keys[i - 1].cam), boxOf(keys[i].cam), p) };
}

const pictureRate = (shot: Shot) => shot.vRate ?? rateOf(shot);

/** The whole demo video: the problem, then the recordings, with labels and your words as captions. */
export default function Cut() {
  const frame = useCurrentFrame();
  const now = TIMELINE.find((e) => frame >= e.start && frame < e.start + e.duration);
  return (
    <AbsoluteFill style={{ background: C.night }}>
      <Sequence durationInFrames={frames(OPEN_S)} name="Opening"><Opening /></Sequence>
      {TIMELINE.map(({ shot, start, duration }) => (
        <Sequence key={shot.id} from={start} durationInFrames={duration} name={shot.id}>
          {shot.src === "phones" ? <Phones shot={shot} /> : shot.src === "certs" ? <Certs shot={shot} /> : shot.src === "close" ? <Close shot={shot} /> : <RecShot shot={shot} />}
        </Sequence>
      ))}
      <CutCaptions beside={now?.shot.src === "phones"} />
    </AbsoluteFill>
  );
}

/** A shot from a screen recording, large, with the step as a small pill over the map's corner. */
function RecShot({ shot }: { shot: Shot }) {
  const frame = useCurrentFrame();
  const { crop, box } = cameraAt(shot, (frame / FPS) * pictureRate(shot));
  const k = box.w / crop.w;
  const separateVoice = shot.vFrom !== undefined && !shot.muted;
  const src = staticFile(`rec/${shot.src}.mp4`);
  return (
    <Stage>
      <div style={{ position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h, overflow: "hidden", borderRadius: 18, background: C.porcelain, boxShadow: "0 30px 80px rgba(5, 8, 18, 0.55)" }}>
        <OffthreadVideo src={src} trimBefore={frames(shot.vFrom ?? shot.from)} playbackRate={pictureRate(shot)} muted={shot.muted || separateVoice}
          style={{ position: "absolute", maxWidth: "none", width: REC_W * k, height: REC_H * k, left: -crop.x * k, top: -crop.y * k }} />
      </div>
      <StepPill shot={shot} box={box} />
      {separateVoice && <Audio src={src} trimBefore={frames(shot.from)} playbackRate={rateOf(shot)} />}
    </Stage>
  );
}

/** The step, what's happening and the model at work, in one line at the bottom left of the video. */
function StepPill({ shot, box }: { shot: Shot; box: Box }) {
  const t = useIn(4);
  if (!shot.eyebrow && !shot.title) return null;
  return (
    <div style={{ position: "absolute", left: box.x + 22, top: box.y + box.h - 22 - 52, opacity: t, transform: `translateY(${(1 - t) * 14}px)`, display: "flex", gap: 10, alignItems: "center", fontFamily: FONT_SANS }}>
      <span style={{ ...pill, background: "rgba(20,29,51,0.92)", border: "none", fontSize: 25 }}>
        {shot.eyebrow && <b style={{ color: C.goldLight, marginRight: 12 }}>{shot.eyebrow}</b>}{shot.title}
      </span>
      {shot.chip && <span style={{ ...pill, background: "rgba(62,104,88,0.95)" }}>{shot.chip}</span>}
      {shot.speed && <span style={{ ...pill, background: C.gold, border: "none" }}>{shot.speed}</span>}
    </div>
  );
}

const pill: CSSProperties = {
  display: "inline-block", padding: "10px 20px", borderRadius: 999, fontSize: 23, fontWeight: 600, color: "#fff",
  background: "rgba(110,158,138,0.22)", border: "1px solid rgba(110,158,138,0.6)", boxShadow: "0 6px 20px rgba(5,8,18,0.35)",
};

/** The opening: the problem at planet scale, your slide, the chair, where it ends up, then Kintsugi. Your
 *  story voice, with your face in a circle, plays over it when public/rec/intro.mp4 is there. */
function Opening() {
  let at = 0;
  const parts = OPEN.map((o) => { const from = frames(at); at += o.seconds; return { ...o, from, dur: frames(o.seconds) }; });
  const part = (id: (typeof OPEN)[number]["id"], node: ReactNode) => {
    const p = parts.find((x) => x.id === id)!;
    const lines = SCRIPT[id];
    return (
      <Sequence key={id} from={p.from} durationInFrames={p.dur} name={id}>
        {node}
        {lines.map((l, i) => <StoryLine key={i} from={frames(l.at)} to={i + 1 < lines.length ? frames(lines[i + 1].at) : undefined}>{l.text}</StoryLine>)}
      </Sequence>
    );
  };
  const face = has("rec/intro.mp4");
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {part("landfill", <Landfill />)}
      {part("problem", <ProblemSlide />)}
      {part("chair", <Chair />)}
      {part("dump", <Dump />)}
      {part("logo", <OpeningLogo />)}
      {face && (
        <div style={{ position: "absolute", right: 50, bottom: 50, width: 260, height: 260, borderRadius: "50%", overflow: "hidden", border: `4px solid ${C.goldLight}`, boxShadow: "0 12px 40px rgba(0,0,0,0.5)" }}>
          <OffthreadVideo src={staticFile("rec/intro.mp4")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      )}
    </AbsoluteFill>
  );
}

/** A line of the story, large, near the top. */
function StoryLine({ children, from = 0, to = 9999 }: { children: ReactNode; from?: number; to?: number }) {
  const frame = useCurrentFrame();
  if (frame < from || frame >= to) return null;
  const t = Math.min(1, (frame - from) / 8);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 60, display: "flex", justifyContent: "center", opacity: t, transform: `translateY(${(1 - t) * 14}px)` }}>
      <div style={{ maxWidth: 1280, textAlign: "center", fontFamily: FONT_SANS, fontSize: 46, fontWeight: 700, lineHeight: 1.25, color: "#fff", background: "rgba(12,17,32,0.72)", borderRadius: 18, padding: "16px 34px" }}>
        {children}
      </div>
    </div>
  );
}

function Landfill() {
  const a = useIn(10), b = useIn(60);
  return (
    <AbsoluteFill>
      <Footage file="01a_landfill_aerial.mp4" />
      <AbsoluteFill style={{ justifyContent: "center", paddingLeft: 120, background: "linear-gradient(90deg, rgba(0,0,0,0.6), transparent 65%)" }}>
        <div style={{ fontFamily: FONT_SANS, color: "#fff", textShadow: "0 3px 12px rgba(0,0,0,0.5)" }}>
          <div style={{ opacity: a, transform: `translateY(${(1 - a) * 20}px)` }}>
            <span style={{ fontSize: 120, fontWeight: 700 }}>2.1 billion tonnes</span>
            <div style={{ fontSize: 42, opacity: 0.92 }}>of city waste a year, worldwide</div>
          </div>
          <div style={{ opacity: b, transform: `translateY(${(1 - b) * 20}px)`, marginTop: 36 }}>
            <span style={{ fontSize: 84, fontWeight: 700, color: C.goldLight }}>3.8 billion by 2050</span>
          </div>
        </div>
      </AbsoluteFill>
      {CLIPS["01a_landfill_aerial.mp4"].ai && <Badge text="AI-generated" corner="tr" tone="ai" />}
      <Source text="Source: UNEP Global Waste Management Outlook 2024" />
    </AbsoluteFill>
  );
}

/** Your problem slide, with a slow push in. */
function ProblemSlide() {
  const frame = useCurrentFrame();
  const t = useIn(0);
  const zoom = interpolate(frame, [0, frames(6.5)], [1, 1.05]);
  return (
    <Stage>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 1720, borderRadius: 20, overflow: "hidden", boxShadow: "0 40px 90px rgba(5,8,18,0.55)", opacity: t, transform: `scale(${zoom * (0.96 + 0.04 * t)})` }}>
          <Img src={staticFile("rec/problem.png")} style={{ width: "100%", display: "block" }} />
        </div>
      </AbsoluteFill>
    </Stage>
  );
}

/** The chair clip, filmed upright: full height in the middle over a blurred copy, the story in captions. */
function Chair() {
  const src = staticFile("rec/chair.mp4");
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <OffthreadVideo src={src} muted playbackRate={VOICE_RATE} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "blur(40px) brightness(0.55)", transform: "scale(1.15)" }} />
      <AbsoluteFill style={{ alignItems: "center" }}>
        <OffthreadVideo src={src} volume={0.4} playbackRate={VOICE_RATE} style={{ height: "100%", boxShadow: "0 0 80px rgba(0,0,0,0.6)" }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

function Dump() {
  return (
    <AbsoluteFill>
      <Footage file="01g_chair_landfill.mp4" />
      {CLIPS["01g_chair_landfill.mp4"].ai && <Badge text="AI-generated" corner="tr" tone="ai" />}
    </AbsoluteFill>
  );
}

function OpeningLogo() {
  const frame = useCurrentFrame();
  return (
    <Stage>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 18 }}>
        <Logo size={190} draw={interpolate(frame, [0, 26], [0, 1], { extrapolateRight: "clamp" })} />
        <Title size={104} delay={6}>Kintsugi</Title>
        <Title size={40} delay={14} color={C.goldLight} style={{ fontFamily: FONT_SANS, fontWeight: 600 }}>Google Maps for the circular economy</Title>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 14, maxWidth: 1500, marginTop: 34 }}>
          {GEMINI.map(([model, job], i) => <GeminiChip key={model} model={model} job={job} delay={frames(3.2) + i * 6} />)}
        </div>
      </AbsoluteFill>
    </Stage>
  );
}

// What each Gemini model does in Kintsugi (backend/app/config.py).
const GEMINI: [string, string][] = [
  ["Gemini 2.5 Pro", "watches the video, hears the voice"],
  ["Gemini 2.5 Flash", "explains, translates, negotiates"],
  ["Gemini 2.5 Flash Image", "renders designs"],
  ["Gemini TTS", "speaks each language"],
  ["Gemini Embedding", "matches needs to things"],
];

function GeminiChip({ model, job, delay }: { model: string; job: string; delay: number }) {
  const t = useIn(delay);
  return (
    <span style={{ ...pill, fontSize: 26, opacity: t, transform: `translateY(${(1 - t) * 16}px)`, background: "rgba(20,29,51,0.9)", border: `1px solid ${C.gold}` }}>
      <b style={{ color: C.goldLight, marginRight: 10 }}>{model}</b>{job}
    </span>
  );
}

/** The same negotiation on two phones, Hindi and English, with your words about languages. */
function Phones({ shot }: { shot: Shot }) {
  const a = useIn(0), b = useIn(8), t = useIn(4);
  const phone = (file: string, label: string, p: number) => (
    <div style={{ opacity: p, transform: `translateY(${(1 - p) * 40}px)`, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <span style={{ ...pill, background: "rgba(20,29,51,0.9)" }}>{label}</span>
      <PhoneFrame height={900}><Footage file={file} trimBefore={frames(2)} /></PhoneFrame>
    </div>
  );
  return (
    <Stage>
      <div style={{ position: "absolute", left: 110, top: 150, width: 820, opacity: t, transform: `translateY(${(1 - t) * 20}px)`, fontFamily: FONT_SANS }}>
        <div style={{ color: C.goldLight, fontSize: 30, fontWeight: 600, marginBottom: 18 }}>{shot.eyebrow}</div>
        <Title size={64} style={{ marginBottom: 30 }}>{shot.title}</Title>
        {shot.chip && <span style={pill}>{shot.chip}</span>}
      </div>
      <div style={{ position: "absolute", right: 110, top: 30, display: "flex", gap: 50 }}>
        {phone("05b_deal_hi.mp4", "Ramesh's phone · Hindi", a)}
        {phone("05c_deal_en.mp4", "Ananya's phone · English", b)}
      </div>
      <Audio src={staticFile(`rec/${voiceOf(shot)}.mp4`)} trimBefore={frames(shot.from)} playbackRate={rateOf(shot)} />
    </Stage>
  );
}

/** The certificate in English, Hindi and Kannada. */
function Certs({ shot }: { shot: Shot }) {
  const box = boxOf({ x: 0, y: 0, w: 1920, h: 1024 });
  return (
    <Stage>
      <div style={{ position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h, overflow: "hidden", borderRadius: 18, boxShadow: "0 30px 80px rgba(5, 8, 18, 0.55)" }}>
        <Footage file="06b_certificate.mp4" playbackRate={2.2} />
      </div>
      <StepPill shot={shot} box={box} />
      <Audio src={staticFile(`rec/${voiceOf(shot)}.mp4`)} trimBefore={frames(shot.from)} playbackRate={rateOf(shot)} />
    </Stage>
  );
}

/** "That's Kintsugi": the mark, the line and the link. */
function Close({ shot }: { shot: Shot }) {
  const frame = useCurrentFrame();
  return (
    <Stage>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 20, paddingBottom: 120 }}>
        <Logo size={200} draw={interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" })} />
        <Title size={110} delay={8}>Kintsugi</Title>
        <Title size={42} delay={16} color={C.goldLight} style={{ fontFamily: FONT_SANS, fontWeight: 600 }}>Google Maps for the circular economy</Title>
        <Title size={30} delay={26} color="rgba(255,255,255,0.75)" style={{ fontFamily: FONT_SANS, fontWeight: 400, marginTop: 16 }}>kintsugi-ai-builder-cup-2026.web.app</Title>
      </AbsoluteFill>
      <Audio src={staticFile(`rec/${voiceOf(shot)}.mp4`)} trimBefore={frames(shot.from)} playbackRate={rateOf(shot)} />
    </Stage>
  );
}

type Word = Caption;
const fix = (text: string) => FIXES.reduce((t, [re, to]) => t.replace(re, to), text);

/** Your words on the final timeline: each kept sentence's words, moved (and sped up) to where the shot plays. */
function useCutWords(): Word[] {
  const sources = ["v1", "v2", "v3"].filter((n) => has(`rec/${n}.words.json`));
  const [words, setWords] = useState<Record<string, Word[]>>({});
  const [handle] = useState(() => (sources.length ? delayRender("Loading the recordings' words") : null));
  useEffect(() => {
    Promise.all(sources.map((n) => fetch(staticFile(`rec/${n}.words.json`)).then((r) => r.json() as Promise<Word[]>).then((w) => [n, w] as const)))
      .then((all) => setWords(Object.fromEntries(all)))
      .finally(() => handle !== null && continueRender(handle));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return useMemo(() => {
    const out: Word[] = [];
    for (const { shot, start } of TIMELINE) {
      if (shot.muted) continue;
      const rate = rateOf(shot);
      const at = (ms: number) => (start / FPS) * 1000 + (ms - shot.from * 1000) / rate;
      for (const w of words[voiceOf(shot)] ?? [])
        if (w.startMs >= shot.from * 1000 - 80 && w.startMs < shot.to * 1000 && !/\[/.test(w.text))
          out.push({ ...w, text: fix(w.text), startMs: at(w.startMs), endMs: at(Math.min(w.endMs, shot.to * 1000)), timestampMs: null });
    }
    return out;
  }, [words]);
}

/** Captions a phrase at a time, the word being said in gold: in the band under the video, or beside the phones. */
function CutCaptions({ beside }: { beside: boolean }) {
  const words = useCutWords();
  const frame = useCurrentFrame();
  const ms = (frame / FPS) * 1000;
  const { pages } = useMemo(() => createTikTokStyleCaptions({ captions: words, combineTokensWithinMilliseconds: 1300 }), [words]);
  const page = pages.find((p) => ms >= p.startMs && ms < p.startMs + Math.min(p.durationMs, 3500));
  if (!page || frame >= CUT_TOTAL) return null;
  const pos: CSSProperties = beside ? { left: 110, width: 820, bottom: 120, justifyContent: "flex-start" } : { left: 0, right: 0, bottom: 22, justifyContent: "center" };
  return (
    <div style={{ position: "absolute", ...pos, display: "flex", pointerEvents: "none" }}>
      <div style={{ maxWidth: 1700, fontFamily: FONT_SANS, fontSize: 38, fontWeight: 600, lineHeight: 1.3, color: "#fff", background: "rgba(12, 17, 32, 0.7)", borderRadius: 14, padding: "10px 24px", whiteSpace: "pre-wrap" }}>
        {page.tokens.map((t, i) => (
          <span key={i} style={{ color: ms >= t.fromMs && ms < t.toMs ? C.goldLight : "#fff" }}>{t.text}</span>
        ))}
      </div>
    </div>
  );
}
