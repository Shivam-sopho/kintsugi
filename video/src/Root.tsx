import { Composition, Folder } from "remotion";
import { FPS, H, W, s } from "./theme";
import { SCENES, TOTAL } from "./timeline";
import Main, { SCENE_COMPONENTS } from "./Main";
import { CaptionsProvider } from "./components/Captions";

/** Main is the full 3:00 video; each scene is also its own composition, to work on one at a time. */
export const RemotionRoot = () => (
  <>
    <Composition id="Main" component={Main} durationInFrames={TOTAL} fps={FPS} width={W} height={H} />
    <Folder name="Scenes">
      {SCENES.map((sc) => {
        const Scene = SCENE_COMPONENTS[sc.id];
        const WithCaptions = () => <CaptionsProvider><Scene /></CaptionsProvider>;
        return <Composition key={sc.id} id={sc.id} component={WithCaptions} durationInFrames={s(sc.seconds)} fps={FPS} width={W} height={H} />;
      })}
    </Folder>
  </>
);
