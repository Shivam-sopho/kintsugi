import { AbsoluteFill, Audio, Freeze, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, FONT_SANS, s } from "../theme";
import { CLIPS, has } from "../clips";
import { Badge, Footage, Logo, Source, Title, useIn } from "../components/ui";

// When, in 01d_chair_breaks.mp4, the chair is broken and still (the frame the rewind freezes on).
export const FREEZE_01D_SEC = 2.4;

/** Scene 1 (0:00–0:30): from the planet to my chair, then rewind into Kintsugi. */
export default function S1Planet() {
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {/* 0:00–0:08 · the planet */}
      <Sequence durationInFrames={s(6)}>
        <Footage file="01a_landfill_aerial.mp4" />
        <BigNumbers />
        {CLIPS["01a_landfill_aerial.mp4"].ai && <Badge text="AI-generated" corner="tr" tone="ai" />}
        <Source text="Source: UNEP Global Waste Management Outlook 2024" />
      </Sequence>
      <Sequence from={s(6)} durationInFrames={s(2)}>
        <Footage file="01b_street_dump.mp4" />
        {CLIPS["01b_street_dump.mp4"].ai && <Badge text="AI-generated" corner="tr" tone="ai" />}
        <Source text="Source: UNEP Global Waste Management Outlook 2024" />
      </Sequence>

      {/* 0:08–0:20 · my chair */}
      <Sequence from={s(8)} durationInFrames={s(4)}><Footage file="01c_room_working.mp4" /></Sequence>
      <Sequence from={s(12)} durationInFrames={s(3)}><Footage file="01d_chair_breaks.mp4" volume={1} /></Sequence>
      {has("audio/sfx_crack.wav") && <Sequence from={s(12.6)} durationInFrames={s(2)}><Audio src={staticFile("audio/sfx_crack.wav")} /></Sequence>}
      <Sequence from={s(15)} durationInFrames={s(2.5)}><Footage file="01e_search_phone.mp4" /></Sequence>
      <Sequence from={s(17.5)} durationInFrames={s(2.5)}><Footage file="01f_drag_to_bin.mp4" /></Sequence>

      {/* 0:20–0:25 · where it goes (match cut) */}
      <Sequence from={s(20)} durationInFrames={s(5)}>
        <MatchCut />
        <Badge text="AI-generated" corner="tr" tone="ai" />
      </Sequence>

      {/* 0:25–0:30 · rewind, freeze, the gold crack, the logo */}
      <Sequence from={s(25)} durationInFrames={s(2.5)}><Rewind /></Sequence>
      {has("audio/sfx_rewind.wav") && <Sequence from={s(25)} durationInFrames={s(2.5)}><Audio src={staticFile("audio/sfx_rewind.wav")} volume={0.8} /></Sequence>}
      <Sequence from={s(27.5)} durationInFrames={s(2.5)}><CrackToLogo /></Sequence>
    </AbsoluteFill>
  );
}

/** The two UNEP figures, so the opening works muted too. */
function BigNumbers() {
  const a = useIn(s(0.6));
  const b = useIn(s(3.2));
  return (
    <AbsoluteFill style={{ justifyContent: "center", paddingLeft: 120, background: "linear-gradient(90deg, rgba(0,0,0,0.55), transparent 60%)" }}>
      <div style={{ fontFamily: FONT_SANS, color: "#fff", textShadow: "0 3px 12px rgba(0,0,0,0.5)" }}>
        <div style={{ opacity: a, transform: `translateY(${(1 - a) * 20}px)` }}>
          <span style={{ fontSize: 120, fontWeight: 700 }}>2.1 billion</span>
          <div style={{ fontSize: 40, opacity: 0.9 }}>tonnes of waste a year</div>
        </div>
        <div style={{ opacity: b, transform: `translateY(${(1 - b) * 20}px)`, marginTop: 40 }}>
          <span style={{ fontSize: 80, fontWeight: 700, color: C.goldLight }}>3.8 billion</span>
          <div style={{ fontSize: 34, opacity: 0.9 }}>by 2050</div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

/** From the chair by the bin to a chair falling into the landfill: a short dissolve. */
function MatchCut() {
  const frame = useCurrentFrame();
  const fade = interpolate(frame, [0, 10], [1, 0], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill>
      <Footage file="01g_chair_landfill.mp4" />
      <AbsoluteFill style={{ opacity: fade }}>
        <Freeze frame={s(2.4)}><Footage file="01f_drag_to_bin.mp4" /></Freeze>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

/**
 * The fast rewind: 01g → 01f → 01d played backwards, sped up. `npm run clips:prepare` builds
 * clips/rewind.mp4 from the real clips with ffmpeg; until then, the placeholders roll backwards.
 */
function Rewind() {
  const frame = useCurrentFrame();
  const third = Math.round(s(2.5) / 3);
  const jitter = Math.sin(frame * 2.3) * 6;
  return (
    <AbsoluteFill style={{ filter: "saturate(0.55) contrast(1.15)" }}>
      {has("clips/rewind.mp4") ? (
        <Footage file="rewind.mp4" />
      ) : (
        <AbsoluteFill style={{ transform: `translateX(${jitter}px)` }}>
          <Sequence durationInFrames={third}><Freeze frame={Math.max(0, s(4) - frame * 8)}><Footage file="01g_chair_landfill.mp4" /></Freeze></Sequence>
          <Sequence from={third} durationInFrames={third}><Freeze frame={Math.max(0, s(2.5) - (frame - third) * 8)}><Footage file="01f_drag_to_bin.mp4" /></Freeze></Sequence>
          <Sequence from={third * 2}><Freeze frame={Math.max(0, s(FREEZE_01D_SEC))}><Footage file="01d_chair_breaks.mp4" /></Freeze></Sequence>
        </AbsoluteFill>
      )}
      {/* tape lines and the rewind mark */}
      <AbsoluteFill style={{ background: "repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0 2px, transparent 2px 6px)", mixBlendMode: "screen" }} />
      <div style={{ position: "absolute", top: 50, left: 60, fontFamily: FONT_SANS, fontWeight: 700, fontSize: 54, color: "#fff", opacity: frame % 10 < 6 ? 1 : 0.4 }}>
        ◀◀
      </div>
    </AbsoluteFill>
  );
}

/** Freeze on the broken chair; a gold crack runs across the frame and resolves into the logo. */
function CrackToLogo() {
  const frame = useCurrentFrame();
  const crack = interpolate(frame, [0, 22], [0, 1], { extrapolateRight: "clamp" });
  const toLogo = interpolate(frame, [26, 44], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const glow = interpolate(frame, [20, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const crackPath = "M -40 260 L 380 330 L 560 300 L 760 470 L 930 430 L 1060 560 L 1300 520 L 1470 680 L 1700 640 L 1980 820";
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ opacity: 1 - toLogo }}>
        <Freeze frame={s(FREEZE_01D_SEC)}><Footage file="01d_chair_breaks.mp4" /></Freeze>
        <AbsoluteFill style={{ background: "rgba(10,14,28,0.35)" }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: C.night, opacity: toLogo }} />
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, opacity: 1 - toLogo * 0.9 }}>
        <defs>
          <linearGradient id="gold" x1="0" x2="1">
            <stop offset="0" stopColor="#8a6514" />
            <stop offset="0.5" stopColor="#f3dfb2" />
            <stop offset="1" stopColor="#b8892b" />
          </linearGradient>
          <filter id="glow"><feGaussianBlur stdDeviation={6 * glow} /></filter>
        </defs>
        <path d={crackPath} fill="none" stroke="url(#gold)" strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" filter="url(#glow)"
          pathLength={1} strokeDasharray="1" strokeDashoffset={1 - crack} opacity={0.8} />
        <path d={crackPath} fill="none" stroke="url(#gold)" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round"
          pathLength={1} strokeDasharray="1" strokeDashoffset={1 - crack} />
      </svg>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: toLogo, gap: 18 }}>
        <Logo size={220} draw={interpolate(frame, [28, 52], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
        <Title size={110} delay={34}>Kintsugi</Title>
        <Title size={40} delay={42} color={C.goldLight} style={{ fontFamily: FONT_SANS, fontWeight: 600 }}>Google Maps for the circular economy</Title>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
