// The long-form (16:9) film: one composition that follows src/film/timeline.gen.ts.
//   scenes  = a set + a mood + who stands where       (from the `> SET:` cues of your marked script)
//   shots   = continuous kinetic camera moves (PUSH, PULL, PAN, ORBIT, WHIP, PUNCH), zero frozen shots
//   events  = era labels, speech bubbles, Akira cutaways, name tags, end card
//   audio   = authentic Gemini voice + layered ducked ambient soundscapes + impact SFX
import React from "react";
import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Character3D, headOf } from "../inkbeat/char/Character3D";
import type { Pose } from "../inkbeat/char/Character3D";
import { CastLight } from "../inkbeat/core/castLight";
import { useFonts } from "../inkbeat/core/frame";
import { Label } from "../inkbeat/core/kit";
import { moodOf } from "../inkbeat/core/moods";
import type { Cam } from "../inkbeat/core/rig";
import { closeUp, heroLow, medium, overTheShoulder, tightCloseUp } from "../inkbeat/core/shots";
import { View } from "../inkbeat/core/View";
import type { Eyes, Mouth, V3 } from "../inkbeat/types";
import { LIP_WORDS } from "./lipsync.gen";
import type { LipWord } from "./lipsync.gen";
import { Akira, Bubble, EndCard, EraLabel, project } from "./overlays";
import { AKIRA_IMG, CAST, DEFAULT_STAGE, SETS, TAGS } from "./registry";
import type { Mark } from "./registry";
import { TIMELINE } from "./timeline.gen";
import type { ShotRec } from "./types";

export const W = 1920;
export const H = 1080;
export const FILM_SECONDS = TIMELINE.duration;

const ease = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3, k = 1): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const rotY = (v: V3, a: number): V3 => [v[0] * Math.cos(a) + v[2] * Math.sin(a), v[1], -v[0] * Math.sin(a) + v[2] * Math.cos(a)];

const markOf = (setId: string, slot: string): Mark => {
  const s = SETS[setId];
  const m = s?.stage?.[slot] ?? DEFAULT_STAGE[slot];
  if (!m) throw new Error(`unknown slot "${slot}" (use FL L CL C CR R FR BL B BR)`);
  return m;
};

function getLipWord(t: number): LipWord | null {
  let low = 0, high = LIP_WORDS.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const w = LIP_WORDS[mid];
    if (t < w.t) high = mid - 1;
    else if (t > w.end) low = mid + 1;
    else return w;
  }
  return null;
}

const ambientFileForSet = (setId: string): string => {
  switch (setId) {
    case "S2": return "audio/ambient_market.wav";
    case "S3": return "audio/ambient_church.wav";
    case "S4": return "audio/ambient_workshop.wav";
    case "S6": return "audio/ambient_pub.wav";
    case "S5": return "audio/ambient_lane.wav";
    default: return "audio/ambient_room.wav";
  }
};

/** Narration-matched prop & environment cutaway camera positions */
const CUTAWAYS: Record<string, { pos: V3; look: V3; fov: number; blur: number }> = {
  buckles: { pos: [-0.6, 1.35, -2.1], look: [-0.6, 1.03, -2.7], fov: 36, blur: 2.8 },
  hammer: { pos: [2.3, 1.05, -0.4], look: [2.0, 0.72, -1.0], fov: 38, blur: 2.5 },
  cattle: { pos: [-6.0, 1.2, 0.4], look: [-7.4, 0.75, -1.2], fov: 42, blur: 1.8 },
  cabbages: { pos: [3.8, 0.95, -2.6], look: [4.3, 0.55, -3.9], fov: 38, blur: 2.2 },
  coins: { pos: [0.6, 1.25, -1.1], look: [0.5, 0.82, -1.5], fov: 32, blur: 3.0 },
  halter: { pos: [-0.2, 1.15, 0.9], look: [0.0, 0.75, 0.0], fov: 35, blur: 2.4 },
  meat_pie: { pos: [-3.4, 1.3, -2.0], look: [-3.9, 1.0, -2.5], fov: 36, blur: 2.5 },
  church_altar: { pos: [0.0, 1.5, -1.2], look: [0.0, 1.25, -2.8], fov: 40, blur: 2.0 },
  tin_box: { pos: [1.7, 0.85, -1.8], look: [2.0, 0.35, -2.4], fov: 34, blur: 2.6 },
  ale_mug: { pos: [0.6, 1.15, -1.0], look: [0.5, 0.84, -1.5], fov: 34, blur: 2.8 },
};

const shotCam = (
  shot: ShotRec,
  setId: string,
  feet: V3,
  height: number,
  yaw: number,
  people: { id: string; mark: Mark; spec: { height: number } }[],
  subjId: string
): { cam: Cam; focus: V3; blur: number } => {
  // If narration matched a prop or environment cutaway, frame the cutaway
  if (shot.cutaway && CUTAWAYS[shot.cutaway]) {
    const c = CUTAWAYS[shot.cutaway];
    return { cam: { pos: c.pos, look: c.look, fov: c.fov, roll: 0 }, focus: c.look, blur: c.blur };
  }

  if (shot.kind === "wide") {
    const m = SETS[setId].master;
    return { cam: { pos: m.pos, look: m.look, fov: m.fov, roll: 0 }, focus: m.look, blur: 0.8 };
  }
  const o = { feet, height, facing: yaw, side: shot.side };
  const partner = people.find((p) => p.id !== subjId);
  if (shot.kind === "ots" && partner) {
    const s = overTheShoulder(o, partner.mark.pos, partner.spec.height);
    return { cam: s.cam, focus: s.focus, blur: s.blur };
  }
  if (shot.kind === "tight") {
    const s = tightCloseUp(o);
    return { cam: s.cam, focus: s.focus, blur: s.blur };
  }
  const s = shot.kind === "close" ? closeUp(o) : shot.kind === "hero" ? heroLow(o) : medium(o);
  return { cam: s.cam, focus: s.focus, blur: s.blur };
};

export const Film: React.FC<{ voice?: boolean }> = ({ voice = true }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ready = useFonts();
  if (!ready) return <AbsoluteFill style={{ background: "#14101a" }} />;
  const t = Math.min(f / fps, TIMELINE.duration - 1e-3);

  let si = TIMELINE.scenes.findIndex((s) => t >= s.start && t < s.end);
  if (si < 0) si = TIMELINE.scenes.length - 1;
  const scene = TIMELINE.scenes[si];
  const set = SETS[scene.set];
  if (!set) throw new Error(`timeline scene ${scene.id} uses set "${scene.set}" which is not in src/film/registry.tsx`);
  let shot = TIMELINE.shots.find((s) => s.scene === si && t >= s.start && t < s.end);
  if (!shot) shot = TIMELINE.shots.filter((s) => s.scene === si).slice(-1)[0];
  if (!shot) throw new Error(`scene ${scene.id} has no shots`);

  const people = scene.cast.map((c) => {
    const spec = CAST[c.id];
    if (!spec) throw new Error(`cast "${c.id}" is not in src/film/registry.tsx`);
    return { id: c.id, spec, mark: markOf(scene.set, c.slot) };
  });
  const subj = people.find((p) => p.id === shot!.subject) ?? people[0];
  const m = moodOf(scene.mood);

  // Character scale: ~1.22x scale in wide Bull Ring market shots per user review
  const marketScale = (scene.set === "S2" && shot.kind === "wide") ? 1.22 : 1.0;

  const { cam: base, focus, blur } = shotCam(shot, scene.set, subj.mark.pos, subj.spec.height * marketScale, subj.mark.yaw, people, subj.id);

  // Kinetic camera moves: PUSH, PULL, PAN, ORBIT, WHIP, PUNCH (Zero Frozen Shots across all 288 shots)
  const shotDur = Math.max(0.1, shot.end - shot.start);
  const shotElapsed = t - shot.start;
  const u = ease(clamp(shotElapsed / shotDur));

  const ev = TIMELINE.events.filter((e) => t >= e.start - 0.3 && t < e.end + 0.3);
  const speakingBubbles = new Set(ev.filter((e) => e.type === "bubble" && t >= e.start && t < e.end).map((e) => e.who));
  const akira = ev.find((e) => e.type === "akira" && t >= e.start && t < e.end);
  const end = TIMELINE.events.find((e) => e.type === "endcard" && t >= e.start);

  const activeLipWord = getLipWord(t);
  const isBidImpact = ev.some((e) => e.type === "bubble" && t >= e.start && t < e.start + 0.35);

  const d = sub(base.look, base.pos);
  const dist = len(d) || 1;
  const right: V3 = [-d[2] / dist, 0, d[0] / dist];

  let camPos: V3 = [...base.pos];
  let camLook: V3 = [...base.look];
  let camFov = base.fov;
  let camRoll = base.roll ?? 0;

  const moveKind = shot.move ?? (shot.zoom < 0 ? "PULL" : "PUSH");

  switch (moveKind) {
    case "PUNCH": {
      const punchU = Math.min(1, shotElapsed / 0.32);
      const punchEase = 1 - Math.pow(1 - punchU, 3);
      camPos = add(base.pos, d, (shot.zoom || 0.12) * punchEase);
      camFov = base.fov - 4 * punchEase;
      break;
    }
    case "PULL": {
      const pullFrac = -Math.abs(shot.zoom || 0.08) * u;
      camPos = add(base.pos, d, pullFrac);
      break;
    }
    case "PAN": {
      const panSide = (shot.side > 0 ? 0.32 : -0.32) * u;
      camPos = add(base.pos, right, panSide);
      camLook = add(base.look, right, panSide * 0.45);
      break;
    }
    case "ORBIT": {
      const orbitAng = (shot.side > 0 ? 0.08 : -0.08) * u;
      camPos = add(base.look, rotY(sub(base.pos, base.look), orbitAng));
      break;
    }
    case "WHIP": {
      const whipU = shotElapsed < 0.18 ? Math.sin((1 - shotElapsed / 0.18) * Math.PI) : 0;
      camRoll += whipU * (shot.side > 0 ? 1.6 : -1.6);
      camLook = [base.look[0] + whipU * (shot.side > 0 ? 0.28 : -0.28), base.look[1], base.look[2]];
      camPos = add(base.pos, d, (shot.zoom || 0.07) * u);
      break;
    }
    case "PUSH":
    default: {
      const pushFrac = (shot.zoom || 0.09) * u;
      camPos = add(base.pos, d, pushFrac);
      break;
    }
  }

  // Camera shake on auction impacts / bids ("SOLD!")
  if (isBidImpact && shotElapsed < 0.32) {
    const shake = Math.sin((t - shot.start) * 55) * Math.exp(-shotElapsed * 10) * 0.035;
    camPos[1] += shake;
  }

  const cam: Cam = { pos: camPos, look: camLook, fov: camFov, roll: camRoll };

  // Scene transitions: subtle 0.22s cinematic dip
  const sceneElapsed = t - scene.start;
  const sceneRemaining = scene.end - t;
  const dipIn = sceneElapsed < 0.22 ? 1 - sceneElapsed / 0.22 : 0;
  const dipOut = sceneRemaining < 0.18 ? 1 - sceneRemaining / 0.18 : 0;
  const sceneDip = Math.max(dipIn, dipOut) * 0.85;

  return (
    <AbsoluteFill style={{ background: "#14101a" }}>
      <View key={scene.id + scene.start} mood={m} cam={cam} t={t} focus={focus} blur={blur} sky={set.sky ?? true} width={W} height={H}>
        <set.Set t={t} />
        {people.map((p) => {
          const charHeight = p.spec.height * marketScale;
          const head = headOf(p.mark.pos, charHeight, p.spec.build);
          const tag = ev.find((e) => e.type === "tag" && e.who === p.id && t >= e.start && t < e.end);
          const yawToCam = Math.atan2(cam.pos[0] - head[0], cam.pos[2] - head[2]);

          // Word-level lip sync: active speaker matches lip_words or bubble
          const isSpeaker =
            (activeLipWord && (activeLipWord.s === p.id || (activeLipWord.s === "NARRATOR" && p.id === "YOU"))) ||
            speakingBubbles.has(p.id);

          const idHash = p.id.charCodeAt(0) * 0.37;
          // Natural periodic blinks every ~3.4s
          const isBlinking = ((t * 0.8 + idHash) % 3.4) < 0.14;

          let mouth: Mouth = "flat";
          let eyes: Eyes = isBlinking ? "closed" : "open";
          let brows: "none" | "neutral" | "angry" | "worried" | "raised" = "neutral";
          let pose: Pose = {};

          if (isSpeaker) {
            const isLoud = activeLipWord && (activeLipWord.w.includes("!") || (activeLipWord.w.toUpperCase() === activeLipWord.w && activeLipWord.w.length > 2));
            const cycle = Math.sin((t - (activeLipWord?.t ?? t)) * 26);
            mouth = isLoud ? "yell" : cycle > 0.25 ? "open" : cycle < -0.25 ? "o" : "smile";
            brows = isLoud ? "raised" : activeLipWord?.w.includes("?") ? "worried" : "neutral";
            if (isLoud && !isBlinking) eyes = "wide";

            // Expressive active gestures while talking
            const g = Math.sin(t * 3.8);
            pose = {
              armR: [32 + g * 12, 50 + Math.cos(t * 3) * 8],
              armRFwd: 28,
              armL: [10 + Math.sin(t * 2) * 5, 14],
              lean: 2 + Math.sin(t * 2) * 1.5,
              bob: Math.sin(t * 3.2) * 1.5,
              headTilt: Math.sin(t * 2.2) * 3.5,
              headNod: Math.abs(Math.sin(t * 4)) * 2.5,
              headYaw: Math.sin(t * 1.8) * 2.0,
            };
          } else {
            // Natural idle breathing, micro-movements & posture (Never a frozen statue)
            if (scene.set === "S2" && p.id === "YOU") brows = "worried";
            pose = {
              armL: [8 + Math.sin(t * 1.3 + idHash) * 3.5, 10 + Math.cos(t * 1.1 + idHash) * 2],
              armR: [8 + Math.cos(t * 1.2 + idHash) * 3.5, 10 + Math.sin(t * 1.4 + idHash) * 2],
              bob: Math.sin(t * 2.6 + idHash) * 1.2,
              headTilt: Math.sin(t * 1.0 + idHash) * 2.4,
              headNod: Math.cos(t * 1.4 + idHash) * 1.6,
              headYaw: Math.sin(t * 0.8 + idHash) * 2.8,
            };
          }

          return (
            <React.Fragment key={p.id}>
              <Character3D
                {...p.spec}
                height={charHeight}
                position={p.mark.pos}
                yaw={p.mark.yaw}
                t={t}
                face={{ eyes, mouth, brows, ...p.spec.face }}
                pose={pose}
                faceCamera={cam.pos}
              />
              {tag ? <Label text={TAGS[p.id] ?? p.id} p={[head[0], head[1] + 0.62, head[2]]} r={[0, yawToCam, 0]} w={0.9} h={0.22} font={0.6} /> : null}
              <CastLight at={head} cam={cam.pos} mood={m} k={p.id === subj.id ? 1 : 0.55} />
            </React.Fragment>
          );
        })}
      </View>

      {/* Cinematic scene transition dip */}
      {sceneDip > 0.01 ? <AbsoluteFill style={{ pointerEvents: "none", background: "#0c0a10", opacity: sceneDip }} /> : null}

      {/* Comic / Auction Impact Flash */}
      {isBidImpact && shotElapsed < 0.2 ? (
        <AbsoluteFill style={{ pointerEvents: "none", background: "rgba(255, 235, 180, 0.15)", mixBlendMode: "screen" }} />
      ) : null}

      {ev.filter((e) => e.type === "label").map((e, i) => (
        <EraLabel key={i} text={e.text} t={t} a={e.start} b={e.end} pos={e.pos} />
      ))}
      {ev
        .filter((e) => e.type === "bubble" && t >= e.start && t < e.end)
        .map((e, i) => {
          const p = people.find((q) => q.id === e.who);
          const at = p ? project(cam, (([x, y, z]) => [x, y + 0.34, z] as V3)(headOf(p.mark.pos, p.spec.height * marketScale, p.spec.build)), W, H) : null;
          return <Bubble key={i} text={e.text} at={at} t={t} a={e.start} b={e.end} />;
        })}
      {akira ? <Akira text={akira.text} mood={akira.mood} t={t} a={akira.start} b={akira.end} img={AKIRA_IMG} /> : null}
      {end ? <EndCard text={end.text} t={t} a={end.start} /> : null}

      {/* Primary Voiceover (Human Gemini TTS) */}
      {voice ? <Audio src={staticFile("vo/voice.mp3")} volume={1.0} /> : null}

      {/* Layered Ambient Audio bed ducked cleanly under voiceover */}
      {voice ? (
        <Audio
          src={staticFile(ambientFileForSet(scene.set))}
          loop
          volume={(fr) => {
            const curTime = fr / fps;
            const w = getLipWord(curTime);
            return w ? 0.09 : 0.24;
          }}
        />
      ) : null}

      {/* Auction Gavel SFX on bids / 'SOLD!' */}
      {voice && isBidImpact && shotElapsed < 0.65 ? (
        <Audio src={staticFile("audio/sfx_gavel.wav")} volume={0.45} />
      ) : null}
    </AbsoluteFill>
  );
};
