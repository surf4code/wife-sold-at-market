import React from "react";
import { Composition } from "remotion";
import { Demo, DEMO_MOODS } from "./demo/Demo";
import { DemoCast } from "./demo/DemoCast";
import { DemoHeads } from "./demo/DemoHeads";
import { DemoMove, MOVE_FRAMES } from "./demo/DemoMove";
import { SUB } from "./inkbeat/core/frame";
import { Film, FILM_SECONDS, H, W } from "./film/Film";
import { TIMELINE } from "./film/timeline.gen";

// DemoHero: a low hero framing with foreground props. Demo: one still. Demo-<mood>: the same frame in each act light. DemoWide: the whole set.
// DemoCast: the three example characters in a row (a landscape family sheet).
// DemoMove: a 3 s beat-rig move (sharp). DemoMoveSub: the same at SUB × fps for motion blur (average with ffmpeg tmix).
export const Root: React.FC = () => (
  <>
    <Composition id="Demo" component={Demo} durationInFrames={30} fps={30} width={1080} height={1920} defaultProps={{ mood: "day", wide: false }} />
    <Composition id="DemoHero" component={Demo} durationInFrames={30} fps={30} width={1080} height={1920} defaultProps={{ mood: "dusk", wide: false, hero: true }} />
    <Composition id="DemoWide" component={Demo} durationInFrames={30} fps={30} width={1080} height={1920} defaultProps={{ mood: "day", wide: true }} />
    {DEMO_MOODS.map((m) => (
      <Composition key={m} id={`Demo-${m}`} component={Demo} durationInFrames={30} fps={30} width={1080} height={1920} defaultProps={{ mood: m, wide: false }} />
    ))}
    <Composition id="DemoCast" component={DemoCast} durationInFrames={30} fps={30} width={1920} height={1080} defaultProps={{ mood: "day" }} />
    <Composition id="DemoMove" component={DemoMove} durationInFrames={MOVE_FRAMES} fps={30} width={1080} height={1920} defaultProps={{ sub: false }} />
    <Composition id="DemoMoveSub" component={DemoMove} durationInFrames={MOVE_FRAMES * SUB} fps={30 * SUB} width={1080} height={1920} defaultProps={{ sub: true }} />
    <Composition id="DemoHeads" component={DemoHeads} durationInFrames={30} fps={30} width={1920} height={1080} defaultProps={{ mood: "day" }} />
    {/* the long-form 16:9 film (src/film/*): duration, fps and everything else come from timeline.gen.ts */}
    <Composition id="Film" component={Film} durationInFrames={Math.ceil(FILM_SECONDS * TIMELINE.fps)} fps={TIMELINE.fps} width={W} height={H} defaultProps={{ voice: true }} />
  </>
);
