import { AbsoluteFill, Sequence } from "remotion";
import { s } from "../theme";
import { Source } from "../components/ui";
import { LaptopScene } from "../components/layouts";

/** Scene 6 (2:08–2:26): the ledger, how each figure is counted, and the certificate. */
export default function S6Ledger() {
  return (
    <AbsoluteFill>
      <Sequence durationInFrames={s(11)}>
        <LaptopScene file="06a_ledger.mp4" heading="Every hand-over is recorded" />
      </Sequence>
      <Sequence from={s(11)} durationInFrames={s(7)}>
        <LaptopScene file="06b_certificate.mp4" heading="A certificate, in Hindi too" />
      </Sequence>
      <Source text="Emission factors: UK Government GHG Conversion Factors 2026 · reuse counts 60% of new (Farrant et al., 2010)" />
    </AbsoluteFill>
  );
}
