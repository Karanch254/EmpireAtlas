import { Composition } from "remotion";
import { AtlasScene } from "./AtlasScene/AtlasScene";
import { MyComposition } from "./Composition";

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
    </>
  );
};
