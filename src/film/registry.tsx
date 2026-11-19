// YOUR film's sets, cast and stage marks. Edit this file (and only this file) per project.
//   SETS[id]   : the set component, a master (wide) camera, and stage marks (slot -> position + yaw)
//   CAST[id]   : a CharacterSpec per named person (plain stickmen: outfit "none", see PLAIN below)
//   TAGS[id]   : the name tag text shown the first time a character appears
// Slots used in the script cues (`> SET: S1 | lamp | YOU@L NED@R`): FL L CL C CR R FR BL B BR  (F = front, B = back)
import React from "react";
import type { CharacterSpec } from "../inkbeat/char/Character3D";
import { HEAD_SHAPES } from "../inkbeat/char/family";
import type { V3 } from "../inkbeat/types";
import { S1_Kitchen, S2_BullRing, S3_StMartins, S4_Workshop, S5_BackStep, S6_PubTable, S7_AtticRoom } from "../sets/MarketSets";

export type Mark = { pos: V3; yaw: number };
export type SetDef = {
  Set: React.FC<{ t: number }>;
  /** the establishing camera: where it stands and what it looks at, vertical fov */
  master: { pos: V3; look: V3; fov: number };
  /** slot -> where a character stands (x, y, z) and the direction it faces (radians, 0 = toward +z / the lens) */
  stage?: Partial<Record<string, Mark>>;
  lamp?: boolean;
  sky?: boolean;
};

/** default marks: a shallow arc, the camera looks down -z so +x is screen-right */
export const DEFAULT_STAGE: Record<string, Mark> = {
  FL: { pos: [-2.6, 0, 1.0], yaw: 0.55 },
  L: { pos: [-1.7, 0, 0.2], yaw: 0.5 },
  CL: { pos: [-0.8, 0, 0], yaw: 0.35 },
  C: { pos: [0, 0, -0.1], yaw: 0 },
  CR: { pos: [0.8, 0, 0], yaw: -0.35 },
  R: { pos: [1.7, 0, 0.2], yaw: -0.5 },
  FR: { pos: [2.6, 0, 1.0], yaw: -0.55 },
  BL: { pos: [-1.6, 0, -2.0], yaw: 0.3 },
  B: { pos: [0, 0, -2.4], yaw: 0 },
  BR: { pos: [1.6, 0, -2.0], yaw: -0.3 },
};

/** Ricks-style stickman: cream head, thin near-black limbs, a flat saturated shirt colour per character */
const LEG = "#1f1c28";
const CREAM = ["#f4dfc4", "#f1d6b8", "#efd0ae", "#f2dcc2"];
/** the stick-limb egg-head family (SKILL.md): thin inked limbs, a big expressive head */
const STICK = { limb: 0.42, hand: 0.85, headScale: 1.08, torso: "barrel" as const };

type Dress = { outfit: "shirt" | "vest" | "jacket" | "sweater" | "apron" | "overalls"; top: string; inner?: string; hat?: "cap" | "flat" | "beanie" | "sunhat"; hatColor?: string; hair?: "none" | "crop" | "swoop" | "curly" | "bob" | "bun" | "sides"; hairColor?: string; mustache?: boolean; beard?: boolean; glasses?: boolean; nose?: "hook" | "button" | "none" };
const P = (height: number, head: keyof typeof HEAD_SHAPES, d: Dress, seed: number, build: Record<string, unknown> = {}): CharacterSpec => ({
  height,
  build: { ...STICK, head: HEAD_SHAPES[head], ...build },
  look: {
    skin: CREAM[seed % CREAM.length],
    outfit: d.outfit,
    colors: { top: d.top, inner: d.inner ?? "#efe6d2", bottom: LEG, shoes: LEG, accent: "#d6b45a" },
    hair: d.hair ?? "none",
    hairColor: d.hairColor ?? "#3d2a22",
    hat: d.hat,
    hatColor: d.hatColor,
    mustache: d.mustache ? "#3a2a22" : undefined,
    beard: d.beard ? "#3a2a22" : undefined,
    glasses: d.glasses,
    face: { nose: d.nose ?? "button", blush: 0.12 },
    seed,
  },
});
// every person gets their own head silhouette, shirt colour and a hat / moustache so a crowd reads at a glance
export const CAST: Record<string, CharacterSpec> = {
  YOU: P(1.66, "egg", { outfit: "shirt", top: "#c4382e", hair: "bun" }, 1),
  NED: P(1.78, "square", { outfit: "jacket", top: "#2e8a86", inner: "#efe6d2", hat: "flat", hatColor: "#6b4b3b", mustache: true, nose: "hook" }, 2),
  PEG: P(1.62, "round", { outfit: "sweater", top: "#d6a137", hair: "bun", hairColor: "#b9bbc0", glasses: true }, 3),
  SAM: P(1.84, "long", { outfit: "vest", top: "#3d5fbf", inner: "#efe6d2", hat: "cap", hatColor: "#3b3d46", mustache: true }, 0),
  DROVER: P(1.74, "pumpkin", { outfit: "jacket", top: "#7a3a2a", inner: "#d6a137", hat: "flat", hatColor: "#5a3a2b", beard: true, nose: "hook" }, 1),
  DAUGHTER: P(1.3, "bean", { outfit: "overalls", top: "#3c5280", inner: "#d6a137", hair: "bob", hairColor: "#a04e2c" }, 2, { headScale: 1.3, armLength: 0.84 }),
  SON: P(1.18, "pointy", { outfit: "overalls", top: "#b0503c", inner: "#efe6d2", hat: "cap", hatColor: "#7c9868" }, 3, { headScale: 1.32, armLength: 0.82 }),
  GRANDDAUGHTER: P(1.62, "pear", { outfit: "shirt", top: "#c46a78", hair: "bob", hairColor: "#26232b" }, 0),
};
export const TAGS: Record<string, string> = { YOU: "YOU", NED: "NED", PEG: "PEG", SAM: "THE LODGER", DROVER: "THE DROVER", DAUGHTER: "YOUR DAUGHTER", SON: "YOUR SON", GRANDDAUGHTER: "GRANDDAUGHTER" };

const ROOM = { pos: [0.4, 1.75, 6.4] as V3, look: [0, 1.35, -1.6] as V3, fov: 48 };
export const SETS: Record<string, SetDef> = {
  S1: { Set: S1_Kitchen, master: ROOM, lamp: true },
  S2: { Set: S2_BullRing, master: { pos: [0.4, 1.95, 6.4], look: [-0.3, 1.7, -2.5], fov: 48 }, sky: true },
  S3: { Set: S3_StMartins, master: { pos: [0.2, 1.8, 6.6], look: [0, 2.0, -2], fov: 52 } },
  S4: { Set: S4_Workshop, master: ROOM, lamp: true },
  S5: { Set: S5_BackStep, master: { pos: [0.4, 1.8, 6.2], look: [-0.6, 1.5, -1.5], fov: 48 }, sky: true },
  S6: { Set: S6_PubTable, master: ROOM, lamp: true },
  S7: {
    Set: S7_AtticRoom,
    master: { pos: [0, 1.8, 5.0], look: [0, 1.45, -1.5], fov: 48 },
    stage: {
      FL: { pos: [-1.4, 0, 0.4], yaw: 0.45 },
      L: { pos: [-0.95, 0, -0.2], yaw: 0.4 },
      CL: { pos: [-0.5, 0, -0.3], yaw: 0.25 },
      C: { pos: [0, 0, -0.4], yaw: 0 },
      CR: { pos: [0.5, 0, -0.3], yaw: -0.25 },
      R: { pos: [0.95, 0, -0.2], yaw: -0.4 },
      FR: { pos: [1.4, 0, 0.4], yaw: -0.45 },
      BL: { pos: [-1.0, 0, -1.8], yaw: 0.3 },
      B: { pos: [0, 0, -2.0], yaw: 0 },
      BR: { pos: [1.0, 0, -1.8], yaw: -0.3 },
    },
    lamp: true,
  },
};
/** optional: your own Akira image in public/ (a flat sage cutaway). null = a plain placeholder drawing */
export const AKIRA_IMG: string | null = null;
