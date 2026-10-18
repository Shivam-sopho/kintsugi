import { AbsoluteFill, Sequence } from "remotion";
import { s } from "../theme";
import { Footage, LowerThird } from "../components/ui";
import { PhoneScene } from "../components/layouts";

/** Scene 4 (1:14–1:26): Ananya asks for wooden chairs and finds mine. */
export default function S4Ananya() {
  return (
    <AbsoluteFill>
      <Sequence durationInFrames={s(6)}>
        <Footage file="04a_ananya_asks.mp4" volume={1} />
      </Sequence>
      <Sequence from={s(6)} durationInFrames={s(4)}>
        <PhoneScene file="04b_search_result.mp4" heading="Matched by meaning" lines={[{ text: "She asked in English; I described it in Hindi", at: 8 }]}>
          <LowerThird text="Gemini Embedding 2: matched by meaning, across languages" delay={4} />
        </PhoneScene>
      </Sequence>
      <Sequence from={s(10)} durationInFrames={s(2)}>
        <PhoneScene file="04c_design_render.mp4" heading="A café from reclaimed things" lines={[{ text: "Architect · Gemini 2.5 Pro and Flash Image", at: 4 }]} />
      </Sequence>
    </AbsoluteFill>
  );
}
