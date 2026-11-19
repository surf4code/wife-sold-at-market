"""Safe render wrapper for an 8 GB / integrated-GPU Windows laptop. Run from the project folder (where package.json is).
    python render.py still  <Composition> out/x.jpg [--scale 0.5] [--frame N]
    python render.py video  <Composition> out/x.mp4 [--draft]            (short pieces; draft = half size)
    python render.py film   Film out/film [--minutes 2] [--draft]        (LONG 16:9 film: resumable chunks -> final.mp4)
The film mode: reads plan/timeline.json, renders N-minute chunks (a crash only costs one chunk; run the same command
again to resume), joins them, muxes public/vo/voice.mp3 (-14 LUFS) and then runs qa_final.py. It REFUSES to start if the
voice is silent or missing. One render at a time (gpu_lock), --gl=angle, concurrency 2.
If Remotion can't download its Chrome (offline/sandbox) set CHROME_PATH to a Chrome/Chromium exe.
"""
import json, os, re, subprocess, sys

mode, comp, out = sys.argv[1:4]
draft = "--draft" in sys.argv
arg = lambda k, d=None: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
scale = arg("--scale", "0.5" if draft else "1")
here = os.path.dirname(os.path.abspath(__file__))
gl = "swiftshader" if os.environ.get("CHROME_PATH") and os.name != "nt" else "angle"
SHELL = os.name == "nt"


def remotion(args):
    cmd = ["npx", "remotion"] + args + [f"--gl={gl}", "--timeout=240000"]
    if os.environ.get("CHROME_PATH"):
        cmd += [f"--browser-executable={os.environ['CHROME_PATH']}"]
    return subprocess.call([sys.executable, os.path.join(here, "gpu_lock.py"), "--"] + cmd, shell=SHELL)


def sh(cmd):
    r = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    return r.returncode, r.stdout.decode("utf8", "replace")


if mode == "still":
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    extra = [f"--frame={arg('--frame')}"] if arg("--frame") else []
    sys.exit(remotion(["still", "src/index.ts", comp, out, f"--scale={scale}"] + extra))

if mode == "video":
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    sys.exit(remotion(["render", "src/index.ts", comp, out, f"--scale={scale}", "--concurrency=2", "--codec=h264", "--crf=18"]))

if mode == "film":
    voice = "public/vo/voice.mp3"
    if not os.path.exists(voice):
        sys.exit(f"STOP: {voice} is missing. Make the real voice first (scripts/tts_edge.py) - never a placeholder.")
    rc, o = sh(["ffmpeg", "-hide_banner", "-i", voice, "-af", "volumedetect", "-f", "null", "-"])
    m = re.search(r"mean_volume: (-?[\d.]+) dB", o)
    if not m or float(m.group(1)) < -45:
        sys.exit(f"STOP: {voice} is silent (mean {m.group(1) if m else '?'} dB). A silent placeholder is not a voice-over. Generate it with scripts/tts_edge.py.")
    tl = json.load(open("plan/timeline.json", encoding="utf8"))
    fps, total = tl["fps"], int(round(tl["duration"] * tl["fps"]))
    per = int(float(arg("--minutes", "2")) * 60 * fps)
    os.makedirs(out, exist_ok=True)
    parts = []
    for i, a in enumerate(range(0, total, per)):
        b = min(total - 1, a + per - 1)
        p = os.path.join(out, f"part_{i:03d}.mp4")
        parts.append(p)
        done = os.path.exists(p + ".ok")
        if done:
            print(f"chunk {i} ({a}-{b}) already rendered, skipping")
            continue
        print(f"chunk {i}: frames {a}-{b} of {total}")
        rc = remotion(["render", "src/index.ts", comp, p, f"--frames={a}-{b}", f"--scale={scale}", "--concurrency=2", "--codec=h264", "--crf=18", "--pixel-format=yuv420p", "--muted", '--props={"voice":false}'])
        if rc != 0:
            sys.exit(f"chunk {i} failed (exit {rc}). Run the same command again to resume from this chunk.")
        open(p + ".ok", "w").write("ok")
    lst = os.path.join(out, "parts.txt")
    open(lst, "w").write("".join(f"file '{os.path.basename(p)}'\n" for p in parts))
    joined = os.path.join(out, "video_only.mp4")
    vf = ["-vf", "fps=30", "-c:v", "libx264", "-crf", "18", "-preset", "veryfast", "-pix_fmt", "yuv420p"] if fps != 30 else ["-c:v", "copy"]
    rc, o = sh(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", lst] + vf + [joined])
    if rc: sys.exit("concat failed:\n" + o[-800:])
    final = os.path.join(out, "final.mp4")
    rc, o = sh(["ffmpeg", "-y", "-i", joined, "-i", voice, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-af", "loudnorm=I=-14:TP=-1:LRA=11", "-c:a", "aac", "-b:a", "192k", "-shortest", final])
    if rc: sys.exit("mux failed:\n" + o[-800:])
    print("wrote", final, "- running the QA gate")
    sys.exit(subprocess.call([sys.executable, os.path.join(here, "qa_final.py"), final, "--timeline", "plan/timeline.json", "--sheet", os.path.join(out, "sheet.jpg")]))

sys.exit("modes: still | video | film")
