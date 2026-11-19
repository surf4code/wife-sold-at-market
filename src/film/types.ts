// The shape of src/film/timeline.gen.ts (written by scripts/build_timeline.py; never edit the .gen file by hand).
export type ShotKind = "wide" | "medium" | "close" | "hero" | "tight" | "ots";
export type ShotMove = "PUSH" | "PULL" | "PAN" | "ORBIT" | "WHIP" | "PUNCH";
export type SceneRec = { id: string; set: string; mood: string; start: number; end: number; cast: { id: string; slot: string }[] };
/** `scene` is an index into scenes; `zoom` continuous smooth camera motion (-0.1 to +0.15); never frozen */
export type ShotRec = {
  scene: number;
  start: number;
  end: number;
  kind: ShotKind;
  subject: string;
  zoom: number;
  side: number;
  move?: ShotMove;
  cutaway?: string;
  text?: string;
};
export type EventRec = {
  type: "label" | "bubble" | "akira" | "endcard" | "tag";
  start: number;
  end: number;
  text: string;
  who?: string;
  mood?: string;
  /** label corner: top-left | top-center */
  pos?: string;
};
export type Timeline = { fps: number; duration: number; title: string; scenes: SceneRec[]; shots: ShotRec[]; events: EventRec[] };
