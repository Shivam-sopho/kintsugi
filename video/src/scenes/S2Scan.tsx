import { AbsoluteFill, Sequence } from "remotion";
import { s } from "../theme";
import { Badge, Footage, LowerThird } from "../components/ui";
import { PhoneScene } from "../components/layouts";

/** Scene 2 (0:30–1:00): rewind, and this time I scan the chair, speaking Hindi. */
export default function S2Scan() {
  return (
    <AbsoluteFill>
      <Sequence durationInFrames={s(3)}>
        <PhoneScene file="02a_home.mp4" heading="This time, I open Kintsugi" lines={[{ text: "“Moving, renovating or demolishing? Don't throw it out.”", at: 10 }]} />
      </Sequence>
      <Sequence from={s(3)} durationInFrames={s(5)}>
        <Footage file="02b_film_chair.mp4" volume={1} />
      </Sequence>
      <Sequence from={s(8)} durationInFrames={s(12)}>
        <PhoneScene file="02c_live_scan.mp4" rate={2} heading="Gemini watches and listens"
          lines={[
            { text: "Every part and its material", at: s(1.5) },
            { text: "Priced with Google Search, with sources", at: s(5) },
            { text: "Code, not the model, picks the next life", at: s(9) },
          ]}>
          <Badge text="Live · sped up 2×" />
        </PhoneScene>
      </Sequence>
      <Sequence from={s(20)} durationInFrames={s(10)}>
        <PhoneScene file="02d_passport.mp4" volume={1} heading="Its next life"
          lines={[
            { text: "What it can become, best first", at: s(0.5) },
            { text: "A new leg costs far less than a new chair", at: s(4) },
            { text: "Kintsugi answers out loud", at: s(7) },
          ]} />
      </Sequence>
      <Sequence from={s(8)} durationInFrames={s(22)}>
        <LowerThird text="Gemini 2.5 Pro · Gemini 2.5 Flash with Google Search · Gemini Embedding 2" delay={s(0.5)} />
      </Sequence>
    </AbsoluteFill>
  );
}
