#!/usr/bin/env python3
"""Final-deliverable check. A video is NOT done until this prints PASS. Needs ffmpeg + ffprobe on PATH.

    python scripts/qa_final.py out/final.mp4 [--timeline plan/timeline.json] [--w 1920 --h 1080] [--sheet out/sheet.jpg]

Catches exactly the failures of a fake "done": silent audio, a video that never changes (one static shot), black/empty
screen regions, wrong size, video shorter/longer than the voice or the plan. Exit code 1 = FAIL. Report the numbers, not
"it works".
"""
import argparse
import json
import re
import subprocess
import sys

ap = argparse.ArgumentParser()
ap.add_argument("video")
ap.add_argument("--timeline", default="plan/timeline.json")
ap.add_argument("--w", type=int, default=1920)
ap.add_argument("--h", type=int, default=1080)
ap.add_argument("--sheet", default="out/sheet.jpg")
ap.add_argument("--step", type=float, default=5.0, help="seconds between sampled frames")
a = ap.parse_args()

fails, notes = [], []


def run(cmd, binary=False):
    r = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return r.stdout if binary else (r.stdout + r.stderr).decode("utf8", "replace")


def probe(entry, stream):
    out = run(["ffprobe", "-v", "error", "-select_streams", stream, "-show_entries", entry, "-of", "default=nw=1:nk=1", a.video]).strip().splitlines()
    return out[0] if out else ""


# ---- 1. container ----
try:
    vw, vh = int(probe("stream=width", "v:0")), int(probe("stream=height", "v:0"))
    vdur = float(run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", a.video]).strip())
except ValueError:
    sys.exit("FAIL: cannot read the file (missing or corrupt): " + a.video)
has_audio = bool(probe("stream=codec_name", "a:0"))
print(f"video {vw}x{vh}, {vdur:.1f}s ({vdur / 60:.1f} min), audio stream: {has_audio}")
if (vw, vh) != (a.w, a.h):
    fails.append(f"size {vw}x{vh}, expected {a.w}x{a.h}")

# ---- 2. audio really contains speech ----
if not has_audio:
    fails.append("no audio stream")
else:
    out = run(["ffmpeg", "-hide_banner", "-i", a.video, "-vn", "-af", "volumedetect,silencedetect=n=-45dB:d=4", "-f", "null", "-"])
    mean = re.search(r"mean_volume: (-?[\d.]+) dB", out)
    mx = re.search(r"max_volume: (-?[\d.]+) dB", out)
    mean_v = float(mean.group(1)) if mean else -99.0
    print(f"audio mean {mean_v} dB, max {mx.group(1) if mx else '?'} dB")
    if mean_v < -45:
        fails.append(f"audio is silent or near-silent (mean {mean_v} dB). A placeholder voice does not count")
    sil = sum(float(x) for x in re.findall(r"silence_duration: ([\d.]+)", out))
    print(f"long silences (>4 s): {sil:.0f}s = {100 * sil / max(vdur, 1):.0f}% of the film")
    if sil / max(vdur, 1) > 0.25:
        fails.append("more than 25% of the film is silence")

# ---- 3. the picture changes and has no dead regions ----
SW, SH = 64, 36
raw = run(["ffmpeg", "-v", "error", "-i", a.video, "-vf", f"fps=1/{a.step},scale={SW}:{SH},format=gray", "-f", "rawvideo", "-"], binary=True)
n = len(raw) // (SW * SH)
frames = [raw[i * SW * SH:(i + 1) * SW * SH] for i in range(n)]
print(f"sampled {n} frames (every {a.step:g}s)")
if n < 3:
    fails.append("too few frames to analyse")
else:
    diffs = [sum(abs(x - y) for x, y in zip(frames[i], frames[i + 1])) / (SW * SH) for i in range(n - 1)]
    static = sum(1 for d in diffs if d < 1.0) / len(diffs)
    cuts = sum(1 for d in diffs if d > 8)
    print(f"static samples {100 * static:.0f}%, clear changes (cuts/moves) {cuts}")
    if static > 0.35:
        fails.append(f"{100 * static:.0f}% of consecutive samples are identical: the picture is not changing")
    # distinct looks: quantise each frame to 8x4 blocks and count unique
    def sig(f):
        return tuple(sum(f[(y * SH // 4 + yy) * SW + x * SW // 8 + xx] for yy in range(SH // 4) for xx in range(SW // 8)) // ((SH // 4) * (SW // 8)) // 24 for y in range(4) for x in range(8))
    uniq = len({sig(f) for f in frames})
    print(f"distinct looks: {uniq} of {n}")
    if n > 12 and uniq < n * 0.25:
        fails.append(f"only {uniq} distinct looks in {n} samples: far too repetitive")
    dead = 0
    for f in frames:
        for cols in (range(SW - 12, SW), range(0, 12)):
            vals = [f[y * SW + x] for y in range(SH) for x in cols]
            m = sum(vals) / len(vals)
            sd = (sum((v - m) ** 2 for v in vals) / len(vals)) ** 0.5
            if m < 40 and sd < 3:
                dead += 1
                break
    if dead > 0.2 * n:
        fails.append(f"a left/right strip of the screen is flat black in {dead} of {n} samples (wrong render size?)")

# ---- 4. matches the plan ----
try:
    tl = json.load(open(a.timeline, encoding="utf8"))
    print(f"plan: {tl['duration']:.1f}s, {len(tl['scenes'])} scenes, {len(tl['shots'])} shots")
    if abs(vdur - tl["duration"]) > 3:
        fails.append(f"video is {vdur:.1f}s but the plan is {tl['duration']:.1f}s: you rendered only part of it")
except FileNotFoundError:
    notes.append(f"no {a.timeline}: could not compare with the plan")

# ---- 5. contact sheet ----
if n >= 3:
    rows = 6
    run(["ffmpeg", "-v", "error", "-y", "-i", a.video, "-vf", f"fps=1/{max(10, vdur / 48):.1f},scale=240:-1,tile=8x{rows}:padding=3:margin=3", "-frames:v", "1", a.sheet])
    print("contact sheet:", a.sheet, "(look at it yourself)")

for x in notes:
    print("note:", x)
if fails:
    print("\nFAIL")
    for x in fails:
        print("  -", x)
    sys.exit(1)
print("\nPASS (mechanical checks only: still look at the contact sheet and a few frames)")
