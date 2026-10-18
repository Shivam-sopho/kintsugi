import { AbsoluteFill, Sequence } from "remotion";
import { s } from "../theme";
import { LowerThird } from "../components/ui";
import { PhoneScene } from "../components/layouts";

/** Scene 3 (1:00–1:14): who can take it, the city as a map, and what's coming. */
export default function S3Map() {
  return (
    <AbsoluteFill>
      <Sequence durationInFrames={s(5)}>
        <PhoneScene file="03a_takers.mp4" heading="Who can take it, nearest first" lines={[{ text: "Repairers, dealers and recyclers from Google Maps", at: 12 }]} />
      </Sequence>
      <Sequence from={s(5)} durationInFrames={s(6)}>
        <PhoneScene file="03b_map_zoom.mp4" heading="The city, as a map of everything reusable"
          lines={[{ text: "Pins in next-life colours", at: 10 }, { text: "Dashed rings: what's coming", at: s(2.5) }]} />
      </Sequence>
      <Sequence from={s(11)} durationInFrames={s(3)}>
        <PhoneScene file="03c_oracle_notice.mp4" heading="What's still to come" lines={[{ text: "A demolition notice in Kannada becomes a ring on the map", at: 6 }]}>
          <LowerThird text="Oracle · Gemini 2.5 Pro reads notices in any language" delay={4} />
        </PhoneScene>
      </Sequence>
    </AbsoluteFill>
  );
}
