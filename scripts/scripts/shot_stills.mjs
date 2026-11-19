// Gate 3 for the long film: render ONE browser + ONE bundle, then a still for the shots of plan/timeline.json.
//   node scripts/shot_stills.mjs                 -> per scene: its first wide / medium / close shot (out/stills/*.jpg + out/stills/sheet.jpg)
//   node scripts/shot_stills.mjs --all           -> every shot (slow for a 20-min film: use --scenes 5-9 to limit)
//   node scripts/shot_stills.mjs --scenes 3-6    -> only scenes 3..6 (1-based, as printed by build_timeline.py)
//   options: --scale 0.5   --out out/stills
// LOOK at the sheet before rendering video. Check: face at 30-45% height, nothing floating in the air or clipped by
// a wall, no empty sky or black strips, the set reads as the place (kitchen, church...), characters stand on the floor.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { bundle } from "@remotion/bundler";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";

const argv = process.argv.slice(2);
const opt = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const scale = Number(opt("--scale", "0.5"));
const outDir = opt("--out", "out/stills");
const all = argv.includes("--all");
const [s0, s1] = opt("--scenes", "1-9999").split("-").map(Number);
const tl = JSON.parse(fs.readFileSync("plan/timeline.json", "utf8"));
fs.mkdirSync(outDir, { recursive: true });

const jobs = [];
tl.scenes.forEach((sc, si) => {
  if (si + 1 < s0 || si + 1 > s1) return;
  const mine = tl.shots.filter((s) => s.scene === si);
  const picks = all ? mine : ["wide", "medium", "close"].map((k) => mine.find((s) => s.kind === k)).filter(Boolean);
  for (const s of picks) {
    const t = Math.min(s.end - 0.25, s.start + Math.min(1.5, (s.end - s.start) / 2));
    jobs.push({ name: `scene${String(si + 1).padStart(2, "0")}_${sc.set}_${s.kind}_${s.subject}_${t.toFixed(1)}s.jpg`, frame: Math.max(0, Math.round(t * tl.fps)) });
  }
});
console.log(`${jobs.length} stills`);

const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const chrome = process.env.CHROME_PATH;
const chromiumOptions = { gl: chrome && process.platform !== "win32" ? "swiftshader" : "angle" };
const browser = await openBrowser("chrome", { browserExecutable: chrome ?? null, chromiumOptions });
const inputProps = { voice: false };
const composition = await selectComposition({ serveUrl, id: "Film", puppeteerInstance: browser, inputProps, chromiumOptions, browserExecutable: chrome ?? null, timeoutInMilliseconds: 240000 });
let n = 0;
for (const j of jobs) {
  await renderStill({ composition, serveUrl, output: path.join(outDir, j.name), frame: j.frame, scale, imageFormat: "jpeg", jpegQuality: 88, inputProps, puppeteerInstance: browser, chromiumOptions, timeoutInMS: 240000, browserExecutable: chrome ?? null });
  console.log(`${++n}/${jobs.length} ${j.name}`);
}
await browser.close({ silent: true });
try {
  const files = jobs.map((j) => path.join(outDir, j.name));
  const cols = 3;
  const rows = Math.ceil(files.length / cols);
  const inputs = files.flatMap((f) => ["-i", f]);
  const filt = files.map((_, i) => `[${i}:v]scale=640:-1[v${i}]`).join(";") + ";" + files.map((_, i) => `[v${i}]`).join("") + `xstack=inputs=${files.length}:layout=` + files.map((_, i) => `${(i % cols) * 640}_${Math.floor(i / cols) * 360}`).join("|") + "[o]";
  execFileSync("ffmpeg", ["-v", "error", "-y", ...inputs, "-filter_complex", filt, "-map", "[o]", "-frames:v", "1", path.join(outDir, "sheet.jpg")]);
  console.log(`contact sheet: ${path.join(outDir, "sheet.jpg")} (${cols}x${rows})`);
} catch (e) {
  console.log("could not build the sheet (ffmpeg missing?); open the jpgs in", outDir);
}
fs.writeFileSync(path.join(outDir, "index.txt"), jobs.map((j) => j.name).join("\n"));
