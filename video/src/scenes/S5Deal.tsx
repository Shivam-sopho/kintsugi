import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from "remotion";
import { C, FONT_SANS, s } from "../theme";
import { Footage, LowerThird, PhoneFrame, Stage, Title, useIn } from "../components/ui";

// Which phone shows the "held at the private limit" note, where (fraction of the screen from the top),
// and when in this scene (seconds) the video zooms in on it.
export const GUARDRAIL: { phone: "hi" | "en"; y: number; fromSec: number; toSec: number } = { phone: "en", y: 0.47, fromSec: 22, toSec: 27 };

/** Scene 5 (1:26–2:08): two agents bargain across languages; limits held in code; a person approves. */
export default function S5Deal() {
  return (
    <AbsoluteFill>
      <Sequence durationInFrames={s(4)}>
        <Footage file="05a_two_phones_wide.mp4" />
      </Sequence>
      <Sequence from={s(4)} durationInFrames={s(28)}>
        <TwoPhones />
      </Sequence>
      <Sequence from={s(32)} durationInFrames={s(10)}>
        <Footage file="05d_approve.mp4" volume={1} />
      </Sequence>
      <Sequence durationInFrames={s(4)}>
        <LowerThird text="A2A protocol · private limits enforced in code" delay={s(1)} />
      </Sequence>
      <Sequence from={s(32)} durationInFrames={s(10)}>
        <LowerThird text="Nothing is sold until a person approves" delay={s(0.5)} />
      </Sequence>
    </AbsoluteFill>
  );
}

function TwoPhones() {
  const frame = useCurrentFrame();
  const zoomIn = interpolate(frame, [s(GUARDRAIL.fromSec - 4), s(GUARDRAIL.fromSec - 4) + 20, s(GUARDRAIL.toSec - 4) - 20, s(GUARDRAIL.toSec - 4)], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const note = useIn(s(GUARDRAIL.fromSec - 4) + 12);
  const showNote = frame >= s(GUARDRAIL.fromSec - 4) && frame < s(GUARDRAIL.toSec - 4);
  // The phone with the note grows toward it; the other one steps back.
  const zoomOn = (phone: "hi" | "en") => phone === GUARDRAIL.phone
    ? { transform: `scale(${1 + zoomIn * 0.35})`, transformOrigin: `50% ${GUARDRAIL.y * 100}%`, zIndex: 2 }
    : { opacity: 1 - zoomIn * 0.6 };
  return (
    <Stage>
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 40, gap: 8, opacity: 1 - zoomIn }}>
        <Title size={50}>Two agents, two languages, one deal</Title>
        <Title size={26} delay={10} color="rgba(255,255,255,0.75)" style={{ fontFamily: FONT_SANS, fontWeight: 600 }}>A2A protocol · private limits enforced in code</Title>
      </AbsoluteFill>
      <AbsoluteFill style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "center", gap: 140, paddingTop: 165 }}>
        <div style={{ textAlign: "center", ...zoomOn("hi") }}>
          <PhoneFrame height={700}><Footage file="05b_deal_hi.mp4" volume={1} /></PhoneFrame>
          <Tag text="Me · Hindi" />
        </div>
        <div style={{ textAlign: "center", ...zoomOn("en") }}>
          <PhoneFrame height={700}><Footage file="05c_deal_en.mp4" /></PhoneFrame>
          <Tag text="Ananya · English" />
        </div>
      </AbsoluteFill>
      {showNote && (
        <div style={{
          position: "absolute", ...(GUARDRAIL.phone === "en" ? { left: 140 } : { left: 1180 }), top: 430, opacity: note, transform: `translateX(${(1 - note) * 20}px)`,
          background: C.paper, color: C.ink, borderRadius: 16, padding: "18px 24px", fontFamily: FONT_SANS, width: 520,
          boxShadow: "0 20px 50px rgba(0,0,0,0.35)", borderLeft: `6px solid ${C.gold}`,
        }}>
          <div style={{ fontSize: 30, fontWeight: 700 }}>Limit held</div>
          <div style={{ fontSize: 24, color: C.slate, marginTop: 6 }}>An agent tried to go past its owner's private limit, and code held it. Neither limit is ever shown.</div>
        </div>
      )}
    </Stage>
  );
}

function Tag({ text }: { text: string }) {
  return <div style={{ marginTop: 14, fontFamily: FONT_SANS, fontSize: 26, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>{text}</div>;
}
