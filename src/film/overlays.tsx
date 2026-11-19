// 2D overlays for the long-form film: era label, speech bubble, Akira cutaway, end card. Pure functions of t.
import React from "react";
import type { Cam } from "../inkbeat/core/rig";
import type { V3 } from "../inkbeat/types";

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
/** fade in 0.25 s, fade out 0.25 s */
export const fade = (t: number, a: number, b: number, d = 0.25) => clamp(Math.min((t - a) / d, (b - t) / d));

/** world point -> screen px for a lens (roll ignored) */
export const project = (cam: Cam, p: V3, w: number, h: number): [number, number] | null => {
  const f = norm(sub(cam.look, cam.pos));
  const r = norm(cross(f, [0, 1, 0]));
  const u = cross(r, f);
  const v = sub(p, cam.pos);
  const z = dot(v, f);
  if (z < 0.1) return null;
  const ty = Math.tan((cam.fov * Math.PI) / 360);
  return [((dot(v, r) / (z * ty * (w / h)) + 1) / 2) * w, ((1 - dot(v, u) / (z * ty)) / 2) * h];
};
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

const STROKE = "0 0 0 #000, 3px 3px 0 #000, -3px -3px 0 #000, 3px -3px 0 #000, -3px 3px 0 #000, 0 4px 0 #000, 0 -4px 0 #000, 4px 0 0 #000, -4px 0 0 #000";

/** the era / age label (top-left), e.g. "1801" over "BIRMINGHAM, ENGLAND" (text split on "/") */
export const EraLabel: React.FC<{ text: string; t: number; a: number; b: number; pos?: string }> = ({ text, t, a, b, pos = "top-left" }) => {
  const lines = text.split("/").map((s) => s.trim());
  const left = pos === "top-center";
  return (
    <div
      style={{
        position: "absolute",
        top: 54,
        left: left ? 0 : 70,
        right: left ? 0 : undefined,
        textAlign: left ? "center" : "left",
        opacity: fade(t, a, b),
        fontFamily: "Poppins, sans-serif",
        fontWeight: 800,
        color: "#fff",
        textShadow: STROKE,
        lineHeight: 1.05,
      }}
    >
      {lines.map((l, i) => (
        <div key={i} style={{ fontSize: i === 0 ? 76 : 40, letterSpacing: 1 }}>
          {l}
        </div>
      ))}
    </div>
  );
};

/** a speech bubble over a head (screen position from project()); text is short, ALL CAPS */
export const Bubble: React.FC<{ text: string; at: [number, number] | null; t: number; a: number; b: number; w?: number; h?: number }> = ({ text, at, t, a, b, w = 1920, h = 1080 }) => {
  if (!at) return null;
  const x = clamp(at[0], 260, w - 260);
  const y = clamp(at[1] - 40, 150, h - 200);
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: "translate(-50%,-100%)", opacity: fade(t, a, b, 0.15) }}>
      <div
        style={{
          background: "#fff",
          border: "6px solid #111",
          borderRadius: 34,
          padding: "14px 34px",
          fontFamily: "Poppins, sans-serif",
          fontWeight: 800,
          fontSize: 54,
          color: "#111",
          whiteSpace: "nowrap",
        }}
      >
        {text}
      </div>
      <div style={{ width: 0, height: 0, margin: "0 auto", borderLeft: "18px solid transparent", borderRight: "18px solid transparent", borderTop: "28px solid #111" }} />
    </div>
  );
};

/** the narrator cutaway: a flat sage backdrop, a plain egg-head drawing (or your own image) and the quip */
export const Akira: React.FC<{ text: string; mood?: string; t: number; a: number; b: number; img?: string | null }> = ({ text, mood = "deadpan", t, a, b, img }) => {
  const m = mood.toLowerCase();
  const eye = (cx: number) =>
    m.includes("wide") ? (
      <circle cx={cx} cy={210} r={17} fill="#fff" stroke="#111" strokeWidth={5} />
    ) : (
      <line x1={cx - 16} y1={212} x2={cx + 16} y2={212} stroke="#111" strokeWidth={7} strokeLinecap="round" />
    );
  return (
    <div style={{ position: "absolute", inset: 0, background: "#a9bf9c", opacity: fade(t, a, b, 0.12) }}>
      {img ? (
        <img src={img} style={{ position: "absolute", left: "50%", top: 70, height: 640, transform: "translateX(-50%)" }} />
      ) : (
        <svg viewBox="0 0 400 640" style={{ position: "absolute", left: "50%", top: 60, height: 640, transform: "translateX(-50%)" }}>
          <line x1={200} y1={330} x2={200} y2={520} stroke="#111" strokeWidth={14} strokeLinecap="round" />
          <line x1={200} y1={370} x2={120} y2={470} stroke="#111" strokeWidth={12} strokeLinecap="round" />
          <line x1={200} y1={370} x2={280} y2={470} stroke="#111" strokeWidth={12} strokeLinecap="round" />
          <line x1={200} y1={520} x2={150} y2={620} stroke="#111" strokeWidth={12} strokeLinecap="round" />
          <line x1={200} y1={520} x2={250} y2={620} stroke="#111" strokeWidth={12} strokeLinecap="round" />
          <ellipse cx={200} cy={200} rx={104} ry={128} fill="#f1d3b8" stroke="#111" strokeWidth={9} />
          {eye(160)}
          {eye(240)}
          {m.includes("smirk") ? <path d="M165 275 Q205 290 245 262" fill="none" stroke="#111" strokeWidth={7} strokeLinecap="round" /> : <line x1={170} y1={275} x2={230} y2={275} stroke="#111" strokeWidth={7} strokeLinecap="round" />}
        </svg>
      )}
      <div
        style={{
          position: "absolute",
          left: 160,
          right: 160,
          bottom: 70,
          textAlign: "center",
          fontFamily: "Poppins, sans-serif",
          fontWeight: 800,
          fontSize: 58,
          color: "#fff",
          textShadow: STROKE,
          lineHeight: 1.15,
        }}
      >
        {text}
      </div>
    </div>
  );
};

export const EndCard: React.FC<{ text: string; t: number; a: number }> = ({ text, t, a }) => (
  <div style={{ position: "absolute", inset: 0, background: "#14101a", opacity: clamp((t - a) / 1.2), display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Poppins, sans-serif", fontWeight: 800, fontSize: 96, color: "#f4efe6" }}>
    {text || "THE END"}
  </div>
);
