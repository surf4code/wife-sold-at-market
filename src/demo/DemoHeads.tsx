// DemoHeads: every head silhouette in HEAD_SHAPES side by side (plain stickmen), to pick a shape per character.
//   npx remotion still src/index.ts DemoHeads out/heads.jpg
// Use one in the cast:  build: { limb: 0.42, hand: 0.85, headScale: 1.08, torso: "barrel", head: HEAD_SHAPES.round }
// or tweak your own: head: { w: 1.1, top: 0.9, bot: 1.2, taper: 0.4, boxy: 0.3 }
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { CAST } from "../film/registry";
import { Character3D } from "../inkbeat/char/Character3D";
import { CastLight } from "../inkbeat/core/castLight";
import { useFonts } from "../inkbeat/core/frame";
import { Label, M, boxG } from "../inkbeat/core/kit";
import { moodOf } from "../inkbeat/core/moods";
import { aim } from "../inkbeat/core/rig";
import { View } from "../inkbeat/core/View";
import type { V3 } from "../inkbeat/types";

const NAMES = Object.keys(CAST);

export const DemoHeads: React.FC<{ mood?: string }> = ({ mood = "day" }) => {
  const ready = useFonts();
  const f = useCurrentFrame();
  if (!ready) return <AbsoluteFill style={{ background: "#1a1220" }} />;
  const t = 1.2 + f / 30;
  const m = moodOf(mood);
  const cam = aim([0, 1.3, 9.0], [0, 1.1, 0], 32, 0.5);
  const x0 = -((NAMES.length - 1) * 1.0) / 2;
  return (
    <AbsoluteFill style={{ background: "#1a1220" }}>
      <View mood={m} cam={cam} t={t} focus={[0, 1.4, 0]} blur={0.2} width={1920} height={1080} sky={false}>
        <M g={boxG(14, 0.1, 8)} c="#c9b89c" tex="planks" p={[0, -0.05, -1]} />
        <M g={boxG(14, 4, 0.2)} c="#a9bf9c" tex="plaster" p={[0, 2, -3.2]} />
        {NAMES.map((n, i) => {
          const p: V3 = [x0 + i * 1.0, 0, 0];
          return (
            <React.Fragment key={n}>
              <Character3D
                {...CAST[n]}
                position={p}
                yaw={0}
                t={t + i}
                face={{ eyes: "open", mouth: "smile", brows: "neutral", blink: false }}
                faceCamera={cam.pos}
              />
              <Label text={n} p={[p[0], 2.2, 0.1]} w={0.9} h={0.15} font={0.7} />
            </React.Fragment>
          );
        })}
        <CastLight at={[0, 1.45, 0]} cam={cam.pos} mood={m} />
      </View>
    </AbsoluteFill>
  );
};
