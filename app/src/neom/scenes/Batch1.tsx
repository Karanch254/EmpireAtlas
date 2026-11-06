import { Composition } from "remotion";
import { FPS, HEIGHT, WIDTH } from "../timing";
import { sceneById, SceneWithNarration } from "./SceneShell";
import { Scene02Mystery } from "./Scene02Mystery";
import { Scene03Oil } from "./Scene03Oil";
import { Scene04NeomBorn } from "./Scene04NeomBorn";
import { Scene05Design } from "./Scene05Design";
import { Scene06InsideCity } from "./Scene06InsideCity";
import { Scene07PhysicsBirds } from "./Scene07PhysicsBirds";
import { Scene08PeopleLand } from "./Scene08PeopleLand";

// Batch 1 (Scenes 2-8): each scene is an independent composition that plays
// its own stretch of the approved narration.

const SCENE_COMPONENTS: { id: number; component: React.FC }[] = [
  { id: 2, component: Scene02Mystery },
  { id: 3, component: Scene03Oil },
  { id: 4, component: Scene04NeomBorn },
  { id: 5, component: Scene05Design },
  { id: 6, component: Scene06InsideCity },
  { id: 7, component: Scene07PhysicsBirds },
  { id: 8, component: Scene08PeopleLand },
];

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

export const Batch1Compositions: React.FC = () => (
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
