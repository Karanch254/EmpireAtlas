import { Composition } from "remotion";
import { FPS, HEIGHT, WIDTH } from "../timing";
import { sceneById, SceneWithNarration } from "./SceneShell";
import { Scene09Money } from "./Scene09Money";
import { Scene10Review } from "./Scene10Review";
import { Scene11WhatExists } from "./Scene11WhatExists";
import { Scene12Pivot } from "./Scene12Pivot";
import { Scene13Revelation } from "./Scene13Revelation";
import { Scene14BiggerPicture } from "./Scene14BiggerPicture";
import { Scene15Outro } from "./Scene15Outro";

// Batch 2 (Scenes 9-15): each scene is an independent composition that plays
// its own stretch of the approved narration.

const SCENE_COMPONENTS: { id: number; component: React.FC }[] = [
  { id: 9, component: Scene09Money },
  { id: 10, component: Scene10Review },
  { id: 11, component: Scene11WhatExists },
  { id: 12, component: Scene12Pivot },
  { id: 13, component: Scene13Revelation },
  { id: 14, component: Scene14BiggerPicture },
  { id: 15, component: Scene15Outro },
];

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

export const Batch2Compositions: React.FC = () => (
  <>
    {SCENE_COMPONENTS.map(({ id, component: C }) => {
      const Wrapped: React.FC = () => (
        <SceneWithNarration sceneId={id}>
          <C />
        </SceneWithNarration>
      );
      return (
        <Composition
          key={id}
          id={`NeomScene${pad(id)}`}
          component={Wrapped}
          durationInFrames={sceneById(id).durationInFrames}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
        />
      );
    })}
  </>
);
