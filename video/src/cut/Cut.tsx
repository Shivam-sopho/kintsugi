import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { AbsoluteFill, Audio, Easing, OffthreadVideo, Sequence, continueRender, delayRender, interpolate, staticFile, useCurrentFrame } from "remotion";
import { createTikTokStyleCaptions, type Caption } from "@remotion/captions";
import { C, FONT_SANS, FPS, H, W } from "../theme";
import { has } from "../clips";
import { Footage, Logo, PhoneFrame, Stage, Title, useIn } from "../components/ui";
import { CHAIR_S, CUT_TOTAL, FIXES, INTRO_S, REC_H, REC_W, TIMELINE, frames, voiceOf, type Cam, type Shot } from "./edl";

type Box = { x: number; y: number; w: number; h: number; side: number };
const MOVE_S = 0.7; // how long a camera move takes

/** Where a part of the recording sits on screen: tall parts on the right with the words beside them, wide parts centred. */
function boxOf(cam: Cam): Box {
  const aspect = cam.w / cam.h;
  if (aspect < 1.2) {
    const h = 1010, w = h * aspect;
    return { x: W - 110 - w, y: 35, w, h, side: 1 };
  }
  const k = Math.min(1800 / cam.w, 900 / cam.h);
  return { x: (W - cam.w * k) / 2, y: 40, w: cam.w * k, h: cam.h * k, side: 0 };
}

const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
function mix<T extends Record<string, number>>(a: T, b: T, p: number): T {
  return Object.fromEntries(Object.keys(a).map((k) => [k, lerp(a[k], b[k], p)])) as T;
}

/** The camera at `t` seconds into a shot's picture. */
function cameraAt(shot: Shot, t: number): { crop: Cam; box: Box } {
  const keys = shot.cam ?? [];
  if (!keys.length) return { crop: { x: 0, y: 0, w: REC_W, h: REC_H }, box: { x: 0, y: 0, w: W, h: H, side: shot.src === "phones" ? 1 : 0 } };
  let i = 0;
  while (i + 1 < keys.length && keys[i + 1].at <= t) i++;
  if (i === 0) return { crop: keys[0].cam, box: boxOf(keys[0].cam) };
  const p = Easing.inOut(Easing.cubic)(Math.min(1, Math.max(0, (t - keys[i].at) / MOVE_S)));
  return { crop: mix(keys[i - 1].cam, keys[i].cam, p), box: mix(boxOf(keys[i - 1].cam), boxOf(keys[i].cam), p) };
}

const pictureTime = (shot: Shot, frame: number) => (frame / FPS) * (shot.vRate ?? shot.rate ?? 1);

/** The whole demo video: your intro, then the recordings, with labels and your words as captions. */
export default function Cut() {
  const frame = useCurrentFrame();
  const now = TIMELINE.find((e) => frame >= e.start && frame < e.start + e.duration);
  const side = now ? cameraAt(now.shot, pictureTime(now.shot, frame - now.start)).box : null;

  return (
    <AbsoluteFill style={{ background: C.night }}>
      <Sequence durationInFrames={frames(INTRO_S)} name="Intro"><Intro /></Sequence>
      {TIMELINE.map(({ shot, start, duration }) => (
        <Sequence key={shot.id} from={start} durationInFrames={duration} name={shot.id}>
          {shot.src === "phones" ? <Phones shot={shot} /> : shot.src === "certs" ? <Certs shot={shot} /> : shot.src === "close" ? <Close shot={shot} /> : <RecShot shot={shot} />}
        </Sequence>
      ))}
      <CutCaptions place={frame < frames(INTRO_S) ? "intro" : side && side.side > 0.5 ? { left: 110, width: side.x - 190 } : "bottom"} />
    </AbsoluteFill>
  );
}

/** A shot from a screen recording: the camera crops and zooms into the part that matters. */
function RecShot({ shot }: { shot: Shot }) {
  const frame = useCurrentFrame();
  const rate = shot.rate ?? 1;
  const { crop, box } = cameraAt(shot, pictureTime(shot, frame));
  const k = box.w / crop.w;
  const ownVoice = rate === 1 && shot.vFrom === undefined;
  const src = staticFile(`rec/${shot.src}.mp4`);
  return (
    <Stage>
      <div style={{ position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h, overflow: "hidden", borderRadius: 18, background: C.porcelain, boxShadow: "0 30px 80px rgba(5, 8, 18, 0.55)" }}>
        <OffthreadVideo src={src} trimBefore={frames(shot.vFrom ?? shot.from)} playbackRate={shot.vRate ?? rate} muted={!ownVoice}
          style={{ position: "absolute", maxWidth: "none", width: REC_W * k, height: REC_H * k, left: -crop.x * k, top: -crop.y * k }} />
      </div>
      <Labels shot={shot} side={box.side} box={box} />
      {shot.vFrom !== undefined && <Audio src={src} trimBefore={frames(shot.from)} />}
    </Stage>
  );
}

/** The step, what's happening and the model at work: beside a tall shot, or as a pill on a wide one. */
function Labels({ shot, side, box }: { shot: Shot; side: number; box: Box }) {
  const t = useIn(4);
  if (!shot.eyebrow && !shot.title) return null;
  return (
    <>
      <div style={{ position: "absolute", left: 110, top: 150, width: Math.max(500, box.x - 190), opacity: side * t, transform: `translateY(${(1 - t) * 20}px)`, fontFamily: FONT_SANS }}>
        {shot.eyebrow && <div style={{ color: C.goldLight, fontSize: 30, fontWeight: 600, marginBottom: 18 }}>{shot.eyebrow}</div>}
        {shot.title && <Title size={64} style={{ marginBottom: 30 }}>{shot.title}</Title>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
          {shot.chip && <span style={pill}>{shot.chip}</span>}
          {shot.speed && <span style={{ ...pill, background: C.gold, borderColor: C.gold }}>{shot.speed}</span>}
        </div>
      </div>
      {side < 1 && (
        <div style={{ position: "absolute", left: box.x + 24, top: box.y + 24, opacity: (1 - side) * t, display: "flex", gap: 12, alignItems: "center", fontFamily: FONT_SANS }}>
          <span style={{ ...pill, background: "rgba(20,29,51,0.9)", fontSize: 26 }}>
            {shot.eyebrow && <b style={{ color: C.goldLight, marginRight: 12 }}>{shot.eyebrow}</b>}{shot.title}
          </span>
        </div>
      )}
    </>
  );
}

const pill: CSSProperties = {
  display: "inline-block", padding: "10px 20px", borderRadius: 999, fontSize: 24, fontWeight: 600, color: "#fff",
  background: "rgba(110,158,138,0.22)", border: "1px solid rgba(110,158,138,0.6)",
};

/** The opening: the chair clip, then your story on camera (public/rec/intro.mp4), or a placeholder until it's there. */
function Intro() {
  return (
    <AbsoluteFill>
      <Sequence durationInFrames={frames(CHAIR_S)} name="Chair"><Chair /></Sequence>
      <Sequence from={frames(CHAIR_S)} name="Your story">
        {has("rec/intro.mp4") ? (
          <OffthreadVideo src={staticFile("rec/intro.mp4")} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        ) : (
          <AbsoluteFill>
            <Footage file="01a_landfill_aerial.mp4" />
            <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", background: "rgba(10,14,28,0.55)" }}>
              <div style={{ border: `2px dashed ${C.gold}`, borderRadius: 18, padding: "30px 44px", background: "rgba(20,29,51,0.8)", color: "#fff", fontFamily: FONT_SANS, textAlign: "center" }}>
                <div style={{ fontSize: 44, fontWeight: 700 }}>Your story, you on camera</div>
                <div style={{ fontSize: 28, opacity: 0.8, marginTop: 10 }}>{Math.round(INTRO_S - CHAIR_S)} s · public/rec/intro.mp4 · lengths in src/cut/edl.ts</div>
              </div>
            </AbsoluteFill>
          </AbsoluteFill>
        )}
      </Sequence>
    </AbsoluteFill>
  );
}

/** The chair clip, filmed upright: full height in the middle, over a blurred copy of itself. */
function Chair() {
  const src = staticFile("rec/chair.mp4");
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <OffthreadVideo src={src} muted style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "blur(40px) brightness(0.55)", transform: "scale(1.15)" }} />
      <AbsoluteFill style={{ alignItems: "center" }}>
        <OffthreadVideo src={src} volume={0.6} style={{ height: "100%", boxShadow: "0 0 80px rgba(0,0,0,0.6)" }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

/** The same negotiation on two phones, Hindi and English, with your words about languages. */
function Phones({ shot }: { shot: Shot }) {
  const a = useIn(0), b = useIn(8);
  const phone = (file: string, label: string, t: number) => (
    <div style={{ opacity: t, transform: `translateY(${(1 - t) * 40}px)`, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <span style={{ ...pill, background: "rgba(20,29,51,0.9)" }}>{label}</span>
      <PhoneFrame height={900}><Footage file={file} trimBefore={frames(2)} /></PhoneFrame>
    </div>
  );
  return (
    <Stage>
      <Labels shot={shot} side={1} box={{ x: 1000, y: 0, w: 0, h: 0, side: 1 }} />
      <div style={{ position: "absolute", right: 110, top: 30, display: "flex", gap: 50 }}>
        {phone("05b_deal_hi.mp4", "Ramesh's phone · Hindi", a)}
        {phone("05c_deal_en.mp4", "Ananya's phone · English", b)}
      </div>
      <Audio src={staticFile(`rec/${voiceOf(shot)}.mp4`)} trimBefore={frames(shot.from)} />
    </Stage>
  );
}

/** The certificate in English, Hindi and Kannada. */
function Certs({ shot }: { shot: Shot }) {
  const box = boxOf({ x: 0, y: 0, w: 1920, h: 1024 });
  return (
    <Stage>
      <div style={{ position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h, overflow: "hidden", borderRadius: 18, boxShadow: "0 30px 80px rgba(5, 8, 18, 0.55)" }}>
        <Footage file="06b_certificate.mp4" playbackRate={1.75} />
      </div>
      <Labels shot={shot} side={0} box={box} />
      <Audio src={staticFile(`rec/${voiceOf(shot)}.mp4`)} trimBefore={frames(shot.from)} />
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
      <Audio src={staticFile(`rec/${voiceOf(shot)}.mp4`)} trimBefore={frames(shot.from)} />
    </Stage>
  );
}

type Word = Caption;
const fix = (text: string) => FIXES.reduce((t, [re, to]) => t.replace(re, to), text);

/** Your words on the final timeline: each kept sentence's words, moved to where the shot plays. */
function useCutWords(): Word[] {
  const sources = ["v1", "v2", "v3", "intro"].filter((n) => has(`rec/${n}.words.json`));
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
    for (const w of words.intro ?? []) if (w.startMs < INTRO_S * 1000) out.push(w);
    for (const { shot, start } of TIMELINE) {
      if ((shot.rate ?? 1) !== 1) continue; // sped up: no voice
      const shift = (start / FPS) * 1000 - shot.from * 1000;
      for (const w of words[voiceOf(shot)] ?? [])
        if (w.startMs >= shot.from * 1000 - 80 && w.startMs < shot.to * 1000 && !/\[/.test(w.text))
          out.push({ ...w, text: fix(w.text), startMs: w.startMs + shift, endMs: Math.min(w.endMs, shot.to * 1000) + shift, timestampMs: null });
    }
    return out;
  }, [words]);
}

/** Captions a phrase at a time, the word being said in gold: beside a tall shot, or along the bottom. */
function CutCaptions({ place }: { place: "intro" | "bottom" | { left: number; width: number } }) {
  const words = useCutWords();
  const frame = useCurrentFrame();
  const ms = (frame / FPS) * 1000;
  const { pages } = useMemo(() => createTikTokStyleCaptions({ captions: words, combineTokensWithinMilliseconds: 1500 }), [words]);
  const page = pages.find((p) => ms >= p.startMs && ms < p.startMs + Math.min(p.durationMs, 4000));
  if (!page || frame >= CUT_TOTAL) return null;
  const pos: CSSProperties = typeof place === "object"
    ? { left: place.left, width: place.width, bottom: 110, textAlign: "left" }
    : { left: 0, right: 0, bottom: place === "intro" ? 60 : 36, textAlign: "center" };
  return (
    <div style={{ position: "absolute", ...pos, display: "flex", justifyContent: typeof place === "object" ? "flex-start" : "center", pointerEvents: "none" }}>
      <div style={{ maxWidth: 1500, fontFamily: FONT_SANS, fontSize: 40, fontWeight: 600, lineHeight: 1.35, color: "#fff", background: "rgba(12, 17, 32, 0.7)", borderRadius: 14, padding: "10px 24px", whiteSpace: "pre-wrap" }}>
        {page.tokens.map((t, i) => (
          <span key={i} style={{ color: ms >= t.fromMs && ms < t.toMs ? C.goldLight : "#fff" }}>{t.text}</span>
        ))}
      </div>
    </div>
  );
}
