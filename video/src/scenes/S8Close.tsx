import { AbsoluteFill, Freeze, Sequence, interpolate, useCurrentFrame } from "remotion";
import { C, FONT_SANS, s } from "../theme";
import { Footage, Logo, Stage, Title, useIn } from "../components/ui";
import { PhoneScene } from "../components/layouts";

/** Scene 8 (2:46–3:00): the same chair in Ananya's café, the landfill crossed out, every city, the end card. */
export default function S8Close() {
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Sequence durationInFrames={s(6)}><PushIn><Footage file="08a_chair_in_cafe.mp4" /></PushIn></Sequence>
      <Sequence from={s(6)} durationInFrames={s(1.5)}><CrossedOut /></Sequence>
      <Sequence from={s(7.5)} durationInFrames={s(3)}>
        <PhoneScene file="08b_city_picker.mp4" heading="Every city in Asia-Pacific"
          lines={[{ text: "Singapore · Tokyo · Jakarta · Bangkok", at: 6 }, { text: "Manila · Kuala Lumpur · Ho Chi Minh City · Sydney", at: 20 }]} />
      </Sequence>
      <Sequence from={s(10.5)} durationInFrames={s(3.5)}><EndCard /></Sequence>
    </AbsoluteFill>
  );
}

function PushIn({ children }: { children: React.ReactNode }) {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{ transform: `scale(${1 + frame / s(6) * 0.08})` }}>{children}</AbsoluteFill>;
}

/** A one-second flash of the opening landfill, crossed out by a gold line. */
function CrossedOut() {
  const frame = useCurrentFrame();
  const line = interpolate(frame, [6, 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill>
      <Freeze frame={s(3)}><Footage file="01a_landfill_aerial.mp4" /></Freeze>
      <AbsoluteFill style={{ background: "rgba(10,14,28,0.35)" }} />
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <line x1={160} y1={900} x2={1760} y2={180} stroke={C.gold} strokeWidth={22} strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - line} />
      </svg>
    </AbsoluteFill>
  );
}

function EndCard() {
  const url = useIn(s(1));
  return (
    <Stage>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 22 }}>
        <Logo size={180} draw={Math.min(1, useCurrentFrame() / 24)} />
        <Title size={96}>Kintsugi</Title>
        <Title size={46} delay={8} color={C.goldLight} style={{ fontFamily: FONT_SANS, fontWeight: 600 }}>Point your phone at anything.</Title>
        <div style={{ marginTop: 24, opacity: url, fontFamily: FONT_SANS, fontSize: 38, fontWeight: 700, color: "#fff", background: "rgba(255,255,255,0.08)", border: `1px solid ${C.gold}`, borderRadius: 999, padding: "12px 34px" }}>
          kintsugi-ai-builder-cup-2026.web.app
        </div>
        <div style={{ opacity: url * 0.7, fontFamily: FONT_SANS, fontSize: 22, color: "#fff", marginTop: 10 }}>
          AI Builder Cup 2026 · Sustainability & Social Impact · Built with Gemini on Google Cloud
        </div>
      </AbsoluteFill>
    </Stage>
  );
}
