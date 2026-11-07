import { Composition } from "remotion";
import { AtlasScene } from "./AtlasScene/AtlasScene";
import { MyComposition } from "./Composition";
import { TimingPreview } from "./neom/preview/TimingPreview";
import { Batch1Compositions } from "./neom/scenes/Batch1";
import { Batch2Compositions } from "./neom/scenes/Batch2";
import { Scene01Composition } from "./neom/scenes/Scene01Composition";
import { FPS, HEIGHT, SCENES, TOTAL_FRAMES, WIDTH } from "./neom/timing";

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
      <Composition
        id="NeomScene01"
        component={Scene01Composition}
        durationInFrames={SCENES[0].durationInFrames}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Batch1Compositions />
      <Batch2Compositions />
    </>
  );
};
