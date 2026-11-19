// The 7 dioramas of "Wife Sold at a Market" (Birmingham, 1801-1869). Each is a pure function of t (flames flicker from t).
// Camera looks down -z; +x is screen-right. Interiors are open at the front (+z) like a stage; characters stand at z ~ 0.
// Dress each set in 3 depth layers: foreground prop near the lens (blurred), the stage, the back wall / backdrop.
import React from "react";
import { Awning, Barrel, Crate, House, Window } from "../demo/Street";
import type { TexKind } from "../inkbeat/mat/materials";
import { Flame, Label, M, boxG, coneG, coreMat, cylG, sphG, torG } from "../inkbeat/core/kit";
import type { V3 } from "../inkbeat/types";

const B = (p: V3, s: V3, c: string, tex?: TexKind, r?: V3, cast = true) => <M g={boxG(s[0], s[1], s[2])} c={c} tex={tex} p={p} r={r} cast={cast} />;
const C = (p: V3, rt: number, rb: number, h: number, c: string, tex?: TexKind, r?: V3) => <M g={cylG(rt, rb, h, 20)} c={c} tex={tex} p={p} r={r} />;
const S = (p: V3, r: number, c: string, s?: V3 | number) => <M g={sphG(r, 18)} c={c} p={p} s={s} />;

const WOOD = "#6b4a34";
const BRASS = "#d1a73e";
const STONE = "#8f8896";

/** an open-front room: floor, back wall (z0) and two side walls, a skirting board, no ceiling */
const Room: React.FC<{ w?: number; d?: number; h?: number; z0?: number; wall: string; wtex?: TexKind; floor: string; ftex?: TexKind; children?: React.ReactNode }> = ({ w = 9.2, d = 9.4, h = 3.6, z0 = -3.4, wall, wtex = "plaster", floor, ftex = "planks", children }) => (
  <group>
    {B([0, -0.1, 0], [40, 0.2, 40], floor, ftex, undefined, false)}
    {B([0, h / 2, z0 - 0.1], [w, h, 0.2], wall, wtex)}
    {B([-w / 2 - 0.1, h / 2, z0 + d / 2], [0.2, h, d], wall, wtex)}
    {B([w / 2 + 0.1, h / 2, z0 + d / 2], [0.2, h, d], wall, wtex)}
    {B([0, h + 0.1, z0 + d / 2], [w + 0.4, 0.2, d], "#4a3a30", "planks", undefined, false)}
    {[0.2, 0.5, 0.8].map((f) => <React.Fragment key={f}>{B([0, h - 0.12, z0 + d * f], [w, 0.24, 0.26], "#3a281e", "wood")}</React.Fragment>)}
    {B([0, 0.14, z0 + 0.03], [w, 0.28, 0.08], "#4a3426", "wood")}
    {B([-w / 2 + 0.03, 0.14, z0 + d / 2], [0.08, 0.28, d], "#4a3426", "wood")}
    {B([w / 2 - 0.03, 0.14, z0 + d / 2], [0.08, 0.28, d], "#4a3426", "wood")}
    {children}
  </group>
);

const Table: React.FC<{ p: V3; w?: number; d?: number; c?: string }> = ({ p, w = 1.8, d = 0.95, c = WOOD }) => (
  <group position={p}>
    {B([0, 0.78, 0], [w, 0.08, d], c, "wood")}
    {[-1, 1].map((sx) => [-1, 1].map((sz) => <React.Fragment key={`${sx}${sz}`}>{B([sx * (w / 2 - 0.1), 0.37, sz * (d / 2 - 0.1)], [0.09, 0.74, 0.09], c, "wood")}</React.Fragment>))}
  </group>
);
const Stool: React.FC<{ p: V3; h?: number }> = ({ p, h = 0.48 }) => (
  <group position={p}>
    {C([0, h, 0], 0.22, 0.22, 0.06, WOOD, "wood")}
    {[0, 1, 2].map((i) => <React.Fragment key={i}>{C([Math.sin((i * 2 * Math.PI) / 3) * 0.14, h / 2, Math.cos((i * 2 * Math.PI) / 3) * 0.14], 0.03, 0.035, h, WOOD, "wood")}</React.Fragment>)}
  </group>
);
const Candle: React.FC<{ p: V3; t: number; seed?: number; s?: number }> = ({ p, t, seed = 0, s = 0.16 }) => (
  <group position={p}>
    {C([0, 0.07, 0], 0.025, 0.028, 0.14, "#f4efdc")}
    <Flame p={[0, 0.13, 0]} s={s} t={t} seed={seed} />
  </group>
);
const Pawn: React.FC<{ p: V3; h?: number; c: string }> = ({ p, h = 1.65, c }) => (
  <group position={p}>
    {C([0, h * 0.36, 0], 0.17, 0.2, h * 0.58, c, "fabric")}
    {S([0, h * 0.8, 0], 0.13, "#e6c3a2", [1, 1.15, 1])}
    {C([-0.1, h * 0.09, 0], 0.045, 0.05, h * 0.18, "#3a3038")}
    {C([0.1, h * 0.09, 0], 0.045, 0.05, h * 0.18, "#3a3038")}
  </group>
);
const Pie: React.FC<{ p: V3 }> = ({ p }) => (
  <group position={p}>
    {C([0, 0.035, 0], 0.17, 0.15, 0.07, "#c9894a")}
    {S([0, 0.07, 0], 0.15, "#dca25e", [1, 0.45, 1])}
  </group>
);

// --------------------------------------------------------------------------- S1: the back room, candle / lamp-lit (home)
export const S1_Kitchen: React.FC<{ t: number }> = ({ t }) => (
  <Room wall="#d6b58a" floor="#8a6a4a">
    {/* hearth and chimney breast */}
    {B([-2.7, 0.8, -3.1], [2.0, 1.6, 0.6], STONE, "stone")}
    {B([-2.7, 0.55, -2.78], [1.1, 0.95, 0.1], "#1a1210")}
    {B([-2.7, 1.68, -2.95], [2.3, 0.14, 0.9], "#5a4030", "wood")}
    {B([-2.7, 2.65, -3.15], [1.5, 2.0, 0.5], "#c4a47c", "plaster")}
    <Flame p={[-2.7, 0.1, -2.95]} s={0.9} t={t} seed={1} />
    {B([-3.3, 1.78, -2.95], [0.3, 0.3, 0.2], BRASS, "metal")}
    {C([-2.15, 1.85, -2.95], 0.13, 0.11, 0.3, "#b4693c", "metal")}
    {/* window, door, shelf */}
    <Window p={[2.4, 1.9, -3.29]} w={1.1} h={1.3} frame="#e8dcc8" />
    {B([0.2, 1.0, -3.28], [1.0, 2.0, 0.08], "#4e3524", "planks")}
    {B([0.55, 1.0, -3.22], [0.06, 0.06, 0.06], BRASS)}
    {B([2.4, 2.9, -3.15], [2.2, 0.06, 0.3], WOOD, "wood")}
    {[-0.8, -0.4, 0, 0.4, 0.8].map((x) => <React.Fragment key={x}>{C([2.4 + x, 3.0, -3.15], 0.12, 0.12, 0.04, "#e8e2d2")}</React.Fragment>)}
    {C([3.3, 3.0, -3.1], 0.09, 0.08, 0.2, "#9a6a46")}
    {/* the table, stools, candle */}
    <Table p={[0.5, 0, -1.4]} />
    <Candle p={[0.4, 0.82, -1.35]} t={t} seed={2} />
    {C([0.95, 0.9, -1.5], 0.07, 0.065, 0.14, "#b8b8c0", "metal")}
    <Stool p={[-0.9, 0, -1.2]} />
    <Stool p={[1.9, 0, -1.3]} />
    {/* rug, sacks of brass filings, broom, a foreground stool for depth */}
    {B([0, 0.012, 0.2], [3.2, 0.02, 2.0], "#8a4a4a", "fabric", undefined, false)}
    {S([3.5, 0.3, -2.4], 0.4, "#b59a6c", [1, 0.8, 0.9])}
    {S([3.9, 0.25, -1.6], 0.3, "#a58a5c", [1, 0.85, 1])}
    {C([3.1, 0.9, -2.9], 0.02, 0.02, 1.8, "#7a5a3a", undefined, [0, 0, 0.12])}
    {C([3.25, 0.08, -2.9], 0.09, 0.12, 0.2, "#c8a45a", undefined, [0, 0, 0.12])}
    <Stool p={[-3.4, 0, 2.6]} h={0.42} />
  </Room>
);

// --------------------------------------------------------------------------- S2: the Bull Ring market, with St Martin's behind
const Stall: React.FC<{ p: V3; color: string; goods: "apples" | "cabbages" | "pies" | "crates" }> = ({ p, color, goods }) => (
  <group position={p}>
    {B([0, 0.45, 0], [2.4, 0.9, 0.9], "#8a6a46", "planks")}
    {B([-1.1, 1.3, -0.4], [0.1, 2.6, 0.1], WOOD, "wood")}
    {B([1.1, 1.3, -0.4], [0.1, 2.6, 0.1], WOOD, "wood")}
    <Awning p={[0, 2.55, 0.1]} w={2.6} color={color} />
    {goods === "apples" && [-0.8, -0.4, 0, 0.4, 0.8].map((x) => <React.Fragment key={x}>{S([x, 1.0, 0.1], 0.1, x > 0 ? "#c0392b" : "#7aa845")}{S([x + 0.1, 1.0, -0.2], 0.1, "#c0392b")}</React.Fragment>)}
    {goods === "cabbages" && [-0.8, -0.3, 0.2, 0.7].map((x) => <React.Fragment key={x}>{S([x, 1.07, 0.05], 0.18, "#7fae5a", [1, 0.85, 1])}</React.Fragment>)}
    {goods === "pies" && [-0.8, -0.3, 0.2, 0.7].map((x) => <React.Fragment key={x}>{<Pie p={[x, 0.9, 0.05]} />}</React.Fragment>)}
    {goods === "crates" && <><Crate p={[-0.6, 0.9, 0]} s={0.4} /><Crate p={[0.2, 0.9, 0.05]} s={0.4} yaw={0.4} /></>}
  </group>
);
const VILLAGERS: [V3, number, string][] = [
  [[-4.4, 0, -5.6], 1.7, "#6b5a4a"], [[-2.0, 0, -6.3], 1.6, "#5a6a7a"], [[1.4, 0, -6.6], 1.75, "#7a5a5a"], [[3.1, 0, -5.8], 1.62, "#8a7a5a"],
  [[5.6, 0, -6.4], 1.7, "#5a5a6a"], [[-6.6, 0, -6.0], 1.55, "#7a6a4a"], [[0.2, 0, -8.0], 1.68, "#6a5a6a"], [[-3.4, 0, -8.4], 1.5, "#5a6a5a"],
];
export const S2_BullRing: React.FC<{ t: number }> = () => (
  <group>
    {B([0, -0.1, 0], [80, 0.2, 80], "#8a8290", "stone", undefined, false)}
    {B([0, 0.01, -3.0], [26, 0.04, 9], "#a89d92", "stone", undefined, false)}
    {/* St Martin's: nave, tower, spire */}
    {B([-6, 4, -17], [8, 8, 14], "#b3a99b", "stone")}
    {B([-6, 9.0, -17], [8.6, 0.5, 14.6], "#4a4a5c", "roofTiles", [0, 0, 0])}
    {B([-6, 8.6, -17], [8.2, 1.2, 14], "#4a4a5c", "roofTiles")}
    {B([-5, 7.5, -9.8], [3.6, 15, 3.6], "#a89e90", "stone")}
    <M g={coneG(2.6, 6.5, 4)} c="#59596b" tex="roofTiles" p={[-5, 18.2, -9.8]} r={[0, Math.PI / 4, 0]} />
    <Window p={[-5, 11.5, -7.99]} w={0.9} h={2.4} frame="#cfc4b2" />
    <Window p={[-9, 3.4, -9.99]} w={1.1} h={3} frame="#cfc4b2" />
    <Window p={[-6.5, 3.4, -9.99]} w={1.1} h={3} frame="#cfc4b2" />
    {/* the houses and inn around the square */}
    <House p={[7.4, 0.16, -9.5]} w={5.6} h={6.2} d={4.4} wall="#b8604a" tex="brick" roof="#4a4a6a" windows={3} lit={[1]} />
    <House p={[13.0, 0.16, -8.5]} w={5} h={5} d={4} wall="#f0c89a" tex="plaster" roof="#9a4a3a" windows={2} />
    <House p={[2.0, 0.16, -12.5]} w={5} h={5.8} d={4} wall="#e8dca8" tex="plaster" roof="#5a4a6a" windows={2} />
    <Label text="THE BULL" p={[7.4, 3.0, -7.25]} w={1.9} h={0.45} fg="#f4ead6" bg="#3a2a2a" font={0.6} />
    {/* stalls, hurdles for the cattle, barrels */}
    <Stall p={[-4.5, 0.02, -3.6]} color="#c83a3a" goods="apples" />
    <Stall p={[4.3, 0.02, -3.9]} color="#3a6ac8" goods="cabbages" />
    <Stall p={[0.3, 0.02, -5.6]} color="#c8a23a" goods="pies" />
    {[0, 1, 2, 3].map((i) => <React.Fragment key={i}>{B([-9 + i * 1.6, 0.9, -1.2], [0.12, 1.8, 0.12], WOOD, "wood")}</React.Fragment>)}
    {B([-7.4, 0.55, -1.2], [5.0, 0.12, 0.08], WOOD, "wood")}
    {B([-7.4, 1.2, -1.2], [5.0, 0.12, 0.08], WOOD, "wood")}
    <Barrel p={[2.7, 0.02, -2.2]} />
    <Barrel p={[3.3, 0.02, -2.4]} />
    <Crate p={[-2.2, 0.02, -2.4]} s={0.55} yaw={0.3} />
    {VILLAGERS.map(([p, h, c], i) => <React.Fragment key={i}>{<Pawn p={p} h={h} c={c} />}</React.Fragment>)}
    {/* foreground, near the lens */}
    <Crate p={[2.9, 0.02, 3.0]} s={0.6} yaw={0.5} />
    {C([-3.1, 0.55, 3.2], 0.05, 0.05, 1.1, "#3a3038", "metal")}
  </group>
);

// --------------------------------------------------------------------------- S3: St Martin's, inside
export const S3_StMartins: React.FC<{ t: number }> = ({ t }) => (
  <Room w={10.4} d={11} h={6} wall="#a99f92" wtex="stone" floor="#80766c" ftex="stone">
    {/* stained glass: a lattice of lit coloured panes */}
    {B([0, 3.2, -3.31], [2.3, 4.6, 0.08], "#3a3238", "stone")}
    {Array.from({ length: 6 * 9 }, (_, i) => {
      const cx = i % 6, cy = Math.floor(i / 6);
      const col = ["#d94a3a", "#3a5ad9", "#e8b83a", "#3aa86a", "#a84ad9"][(cx * 3 + cy * 2) % 5];
      return <mesh key={i} geometry={boxG(0.3, 0.46, 0.02)} material={coreMat(col, 0.9)} position={[-0.9 + cx * 0.36, 1.2 + cy * 0.5, -3.25]} />;
    })}
    {/* pillars, pews in rows facing the altar, aisle in the middle */}
    {[-2.7, 2.7].map((x) => [-0.8, -2.6].map((z) => <React.Fragment key={`${x}${z}`}>{C([x, 3, z], 0.36, 0.4, 6, "#b3a99b", "stone")}</React.Fragment>))}
    {[-1, 1].map((sx) => [2.6, 1.6, 0.6].map((z) => (
      <React.Fragment key={`${sx}${z}`}>
        {B([sx * 2.5, 0.28, z], [2.6, 0.12, 0.5], WOOD, "wood")}
        {B([sx * 2.5, 0.12, z], [2.6, 0.24, 0.1], "#4a3426", "wood")}
        {B([sx * 2.5, 0.78, z - 0.28], [2.6, 0.9, 0.08], WOOD, "wood")}
      </React.Fragment>
    )))}
    {/* altar, cross, candles */}
    {B([0, 0.5, -2.75], [2.4, 1.0, 0.8], "#e8e2d6", "fabric")}
    {B([0, 1.02, -2.75], [2.5, 0.06, 0.9], "#b3a99b", "stone")}
    {B([0, 1.7, -2.9], [0.12, 1.2, 0.08], BRASS, "metal")}
    {B([0, 2.0, -2.9], [0.6, 0.12, 0.08], BRASS, "metal")}
    <Candle p={[-0.8, 1.05, -2.75]} t={t} seed={3} s={0.18} />
    <Candle p={[0.8, 1.05, -2.75]} t={t} seed={4} s={0.18} />
    {/* side windows and a pulpit */}
    {[-1, 1].map((sx) => <React.Fragment key={sx}>{B([sx * 5.15, 3.4, -0.5], [0.06, 3.4, 1.0], "#4a4a8a")}</React.Fragment>)}
    {B([-4.2, 1.5, -2.6], [1.0, 3.0, 1.0], WOOD, "wood")}
    {B([-4.2, 1.7, -1.9], [0.9, 0.9, 0.1], "#5a4030", "wood")}
  </Room>
);

// --------------------------------------------------------------------------- S4: the buckle workshop
export const S4_Workshop: React.FC<{ t: number }> = ({ t }) => (
  <Room wall="#a0553f" wtex="brick" floor="#6a5440">
    {/* workbench with vice, brass rings and tools */}
    {B([-0.8, 0.95, -2.9], [4.4, 0.12, 0.9], "#7a5a3a", "wood")}
    {[-2.8, 1.2].map((x) => <React.Fragment key={x}>{B([x, 0.45, -2.9], [0.12, 0.9, 0.8], "#5a4030", "wood")}</React.Fragment>)}
    {B([-2.4, 1.13, -2.7], [0.3, 0.24, 0.3], "#4a4a52", "metal")}
    {C([-2.4, 1.28, -2.5], 0.03, 0.03, 0.45, "#4a4a52", undefined, [Math.PI / 2, 0, 0])}
    {[0, 1, 2, 3, 4, 5].map((i) => <M key={i} g={torG(0.09, 0.02)} c={BRASS} tex="metal" p={[-1.4 + i * 0.28, 1.03, -2.7 + (i % 2) * 0.12]} r={[Math.PI / 2, 0, 0]} />)}
    {B([0.3, 1.03, -2.8], [0.5, 0.06, 0.3], "#7a7a84", "metal")}
    {/* shelves of brass, tools on the wall */}
    {B([-1.0, 2.35, -3.2], [4.0, 0.07, 0.4], WOOD, "wood")}
    {[-2.4, -1.8, -1.2, -0.5, 0.2, 0.8].map((x, i) => <React.Fragment key={x}>{C([x, 2.5, -3.15], 0.11 + (i % 3) * 0.02, 0.1, 0.2 + (i % 2) * 0.1, BRASS, "metal")}</React.Fragment>)}
    {B([-0.8, 3.0, -3.28], [4.2, 1.0, 0.05], "#5a4030", "planks")}
    {[-2.4, -1.7, -1.0, -0.3, 0.4, 1.1].map((x, i) => <React.Fragment key={x}>{B([x, 3.0, -3.2], [0.08, 0.5 + (i % 3) * 0.1, 0.05], "#8a8a94", "metal")}</React.Fragment>)}
    <Window p={[-3.7, 1.9, -3.29]} w={1.0} h={1.2} frame="#d8c8a8" />
    {/* the forge: brick hearth, glowing mouth, hood, anvil on a stump */}
    {B([3.2, 0.55, -2.5], [1.7, 1.1, 1.1], "#8a4a3a", "brick")}
    {B([3.2, 0.85, -1.93], [0.9, 0.5, 0.06], "#1a1210")}
    <mesh geometry={boxG(0.8, 0.4, 0.04)} material={coreMat("#ff8a2a", 1.5)} position={[3.2, 0.85, -1.9]} />
    <Flame p={[3.2, 0.7, -2.3]} s={0.7} t={t} seed={5} />
    {B([3.2, 2.6, -2.9], [1.5, 2.4, 0.6], "#8a4a3a", "brick")}
    {C([2.0, 0.3, -1.0], 0.3, 0.33, 0.6, "#5a4030", "wood")}
    {B([2.0, 0.7, -1.0], [0.7, 0.18, 0.28], "#3a3a44", "metal")}
    <M g={coneG(0.12, 0.35, 12)} c="#3a3a44" tex="metal" p={[2.5, 0.72, -1.0]} r={[0, 0, -Math.PI / 2]} />
    <Barrel p={[-4.0, 0, -1.8]} />
    <Crate p={[-3.5, 0, -0.6]} s={0.5} yaw={0.4} />
    {/* hanging lantern */}
    {C([0.2, 3.1, -1.0], 0.01, 0.01, 1.0, "#2a2a30")}
    <mesh geometry={sphG(0.12, 14)} material={coreMat("#ffd890", 1.2)} position={[0.2, 2.55, -1.0]} />
    <Stool p={[-3.0, 0, 2.7]} />
  </Room>
);

// --------------------------------------------------------------------------- S5: the back step in the lane (pies and peas)
export const S5_BackStep: React.FC<{ t: number }> = () => (
  <group>
    {B([0, -0.1, 0], [60, 0.2, 60], "#8a8290", "stone", undefined, false)}
    {/* the house wall on the left with its door, step and pie window */}
    {B([-4.15, 3, -2], [0.3, 6, 14], "#b8604a", "brick")}
    {B([-3.98, 1.0, 0.3], [0.08, 2.0, 0.95], "#4e3524", "planks")}
    {B([-3.45, 0.14, 0.3], [0.9, 0.28, 1.2], "#a89d92", "stone")}
    {B([-3.1, 0.07, 0.3], [0.5, 0.14, 1.2], "#a89d92", "stone")}
    <group position={[-3.99, 1.45, -2.5]} rotation={[0, Math.PI / 2, 0]}>
      <Window p={[0, 0, 0]} w={1.3} h={1.0} lit frame="#e8dcc8" />
      {B([0, -0.62, 0.14], [1.6, 0.08, 0.4], WOOD, "wood")}
      {[-0.45, 0, 0.45].map((x) => <React.Fragment key={x}>{<Pie p={[x, -0.58, 0.14]} />}</React.Fragment>)}
    </group>
    <Label text="HOT PIES" p={[-3.98, 2.9, -2.5]} r={[0, Math.PI / 2, 0]} w={1.6} h={0.4} fg="#f4ead6" bg="#3a2a2a" font={0.6} />
    {/* the wall at the back with a gate, a washing line */}
    {B([0.5, 3, -5.2], [12, 6, 0.3], "#c07a5e", "brick")}
    {B([1.8, 1.1, -5.0], [1.5, 2.2, 0.1], "#4e3524", "planks")}
    {B([4.8, 3, -1.5], [0.3, 6, 8], "#e0cfa8", "plaster")}
    {C([0.2, 3.3, -4.2], 0.015, 0.015, 8, "#3a3038", undefined, [0, 0, Math.PI / 2])}
    {[-2.4, -1.0, 0.8, 2.4].map((x, i) => <React.Fragment key={x}>{B([x, 2.9, -4.2], [0.7, 0.8 - (i % 2) * 0.2, 0.03], i % 2 ? "#e8e2d6" : "#a8b8c8", "fabric")}</React.Fragment>)}
    {/* the upturned bucket, rain barrel, crates, a bowl of peas on the step */}
    {C([-2.2, 0.17, -0.4], 0.2, 0.17, 0.34, "#7a5a3a", "wood")}
    <Barrel p={[3.8, 0, -3.6]} />
    <Crate p={[2.9, 0, -4.2]} s={0.6} yaw={0.2} />
    <Crate p={[3.3, 0, -4.1]} s={0.45} yaw={-0.3} />
    {C([-3.15, 0.18, 0.7], 0.2, 0.14, 0.09, "#d8cdb8")}
    {[0, 1, 2, 3, 4].map((i) => <React.Fragment key={i}>{S([-3.15 + Math.sin(i * 1.7) * 0.08, 0.26, 0.7 + Math.cos(i * 2.3) * 0.08], 0.04, "#7fae5a")}</React.Fragment>)}
    <Crate p={[2.2, 0, 3.0]} s={0.55} yaw={0.4} />
  </group>
);

// --------------------------------------------------------------------------- S6: the pub, a round table and tankards
export const S6_PubTable: React.FC<{ t: number }> = ({ t }) => (
  <Room wall="#6e4d3c" wtex="planks" floor="#5a4030">
    {/* ceiling beams read as a low room */}
    {[-1.2, 1.0].map((z) => <React.Fragment key={z}>{B([0, 3.45, z], [9.2, 0.25, 0.3], "#3a281e", "wood")}</React.Fragment>)}
    {/* the bar: counter, kegs, shelf of jugs */}
    {B([-2.5, 0.55, -2.9], [3.6, 1.1, 0.75], "#7a5a3a", "wood")}
    {B([-2.5, 1.13, -2.9], [3.8, 0.07, 0.85], "#5a4030", "wood")}
    <Barrel p={[-3.8, 0, -3.1]} />
    <Barrel p={[-2.9, 0, -3.15]} />
    {B([-2.5, 2.2, -3.2], [3.6, 0.07, 0.35], WOOD, "wood")}
    {[-3.8, -3.3, -2.8, -2.3, -1.8, -1.3].map((x, i) => <React.Fragment key={x}>{C([x, 2.35 + (i % 2) * 0.03, -3.2], 0.09, 0.1, 0.28 + (i % 3) * 0.06, i % 2 ? "#6a8a5a" : "#b08a5a")}</React.Fragment>)}
    <Label text="ALE" p={[-2.5, 3.0, -3.28]} w={1.2} h={0.5} fg="#f4ead6" bg="#2a1e18" font={0.7} />
    <Window p={[3.3, 1.9, -3.29]} w={1.0} h={1.1} frame="#4a3426" />
    {/* the round table, stools, tankards, hanging lamp */}
    {C([0.5, 0.78, -1.5], 0.9, 0.9, 0.08, WOOD, "wood")}
    {C([0.5, 0.38, -1.5], 0.09, 0.14, 0.76, WOOD, "wood")}
    {[0, 1, 2, 3].map((i) => <React.Fragment key={i}>{C([0.5 + Math.cos(i * 1.6) * 0.45, 0.89, -1.5 + Math.sin(i * 1.6) * 0.4], 0.07, 0.06, 0.14, "#b8b8c0", "metal")}</React.Fragment>)}
    <Stool p={[-0.9, 0, -1.3]} />
    <Stool p={[1.9, 0, -1.4]} />
    <Stool p={[0.6, 0, -2.6]} />
    {C([0.5, 3.0, -1.5], 0.01, 0.01, 1.0, "#2a2a30")}
    <mesh geometry={sphG(0.14, 14)} material={coreMat("#ffc878", 1.3)} position={[0.5, 2.5, -1.5]} />
    <Candle p={[0.5, 0.82, -1.5]} t={t} seed={6} s={0.14} />
    <Stool p={[3.5, 0, 2.7]} />
  </Room>
);

// --------------------------------------------------------------------------- S7: the lodger's attic: slanted ceiling, straw pallet
export const S7_AtticRoom: React.FC<{ t: number }> = ({ t }) => (
  <group>
    {B([0, -0.1, 0], [40, 0.2, 40], "#6a5440", "planks", undefined, false)}
    {/* Gable back wall */}
    {B([0, 2.2, -3.5], [7.6, 4.4, 0.2], "#8a6a4a", "planks")}
    {/* The two sloped roof planes (A-frame: apex 4.3 m, eaves 1.9 m) */}
    {[-1, 1].map((s) => (
      <React.Fragment key={s}>
        {B([s * 1.8, 3.1, 0.5], [4.2, 0.16, 12], "#7a5a3a", "planks", [0, 0, -s * 0.58])}
        {/* Rafters placed behind the camera safe plane (z <= 0) to avoid any clipping */}
        {[-3.2, -1.8, -0.4].map((z) => (
          <React.Fragment key={z}>
            {B([s * 1.78, 2.98, z], [4.1, 0.18, 0.16], "#4a3426", "wood", [0, 0, -s * 0.58])}
            {B([0, 3.5, z], [2.6, 0.14, 0.14], "#4a3426", "wood")}
          </React.Fragment>
        ))}
        {/* Knee walls under the eaves */}
        {B([s * 3.6, 0.95, 0.5], [0.14, 1.9, 12], "#8a6a4a", "planks")}
      </React.Fragment>
    ))}
    {/* Apex ridge beam */}
    {B([0, 4.25, 0.5], [0.2, 0.22, 12], "#3a281e", "wood")}
    {/* the straw pallet, blanket, trunk, a candle on a crate */}
    {B([-1.8, 0.14, -1.9], [1.9, 0.28, 0.95], "#d6bf6e", "fabric")}
    {B([-1.8, 0.32, -1.9], [1.7, 0.08, 0.8], "#7a4a4a", "fabric")}
    {S([-2.55, 0.4, -1.9], 0.2, "#e8e2d6", [1, 0.5, 0.8])}
    {B([2.0, 0.3, -2.4], [1.1, 0.6, 0.6], "#5a4030", "wood")}
    {B([2.0, 0.64, -2.4], [1.14, 0.1, 0.64], "#3a281e", "wood")}
    <Crate p={[0.2, 0, -2.6]} s={0.5} />
    <Candle p={[0.2, 0.5, -2.6]} t={t} seed={7} s={0.16} />
    {/* a small round window with cold light, hanging shirt, bucket */}
    {M2()}
    {B([-0.2, 2.5, -3.3], [0.55, 0.9, 0.04], "#c8c0b0", "fabric")}
    {C([2.5, 0.17, -1.0], 0.2, 0.17, 0.34, "#7a5a3a", "wood")}
    <Stool p={[-2.2, 0, 1.5]} h={0.42} />
  </group>
);
function M2() {
  return (
    <group position={[1.7, 2.1, -3.38]}>
      <mesh geometry={cylG(0.42, 0.42, 0.03, 28)} material={coreMat("#9ab8e8", 0.95)} rotation={[Math.PI / 2, 0, 0]} />
      <M g={torG(0.44, 0.04)} c="#4a3426" tex="wood" />
      {B([0, 0, 0.03], [0.04, 0.84, 0.03], "#4a3426")}
      {B([0, 0, 0.03], [0.84, 0.04, 0.03], "#4a3426")}
    </group>
  );
}
