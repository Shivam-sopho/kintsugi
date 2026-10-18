import { AbsoluteFill, Audio, Series, staticFile } from "remotion";
import { s } from "./theme";
import { SCENES } from "./timeline";
import { has } from "./clips";
import { CaptionsOverlay, CaptionsProvider } from "./components/Captions";
import S1Planet from "./scenes/S1Planet";
import S2Scan from "./scenes/S2Scan";
import S3Map from "./scenes/S3Map";
import S4Ananya from "./scenes/S4Ananya";
import S5Deal from "./scenes/S5Deal";
import S6Ledger from "./scenes/S6Ledger";
import S7Hood from "./scenes/S7Hood";
import S8Close from "./scenes/S8Close";

export const SCENE_COMPONENTS = { S1Planet, S2Scan, S3Map, S4Ananya, S5Deal, S6Ledger, S7Hood, S8Close };

// No music while the chair breaks (0:12–0:15), and quieter under the voice.
const musicVolume = (f: number) => (f >= s(12) && f < s(15) ? 0 : 0.12);

/** The whole video: the eight scenes in order, the voiceover, quiet music, burned-in captions. */
export default function Main() {
  return (
    <CaptionsProvider>
      <AbsoluteFill style={{ background: "#000" }}>
        <Series>
          {SCENES.map((sc) => {
            const Scene = SCENE_COMPONENTS[sc.id];
            return <Series.Sequence key={sc.id} durationInFrames={s(sc.seconds)} name={sc.title}><Scene /></Series.Sequence>;
          })}
        </Series>
        {has("voiceover.wav") && <Audio src={staticFile("voiceover.wav")} />}
        {has("audio/music.mp3") && <Audio src={staticFile("audio/music.mp3")} volume={musicVolume} />}
        <CaptionsOverlay />
      </AbsoluteFill>
    </CaptionsProvider>
  );
}
