import { Composition } from "remotion";
import { AtlasScene } from "./AtlasScene/AtlasScene";
import { MyComposition } from "./Composition";
import { TimingPreview } from "./neom/preview/TimingPreview";
import { FPS, HEIGHT, TOTAL_FRAMES, WIDTH } from "./neom/timing";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <MyComposition />
      <Composition
        id="AtlasScene"
        component={AtlasScene}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="NeomTimingPreview"
        component={TimingPreview}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
};
