"""One command for the whole long film. Run from the project folder.
  python scripts/make_film.py                 # script -> voice -> timings -> timeline -> stills -> render -> QA
  python scripts/make_film.py --voice own     # use your own recording at public/vo/voice.mp3 (default: gemini if GEMINI_API_KEY is set)
  python scripts/make_film.py --until stills  # stop after: plan | voice | timeline | stills | render
  python scripts/make_film.py --minutes 2     # render chunk length (resumable)
Every step prints PASS/FAIL and the run stops at the first failure with the reason. It never claims 'done' unless qa_final.py passed."""
import os, subprocess, sys
from pathlib import Path

HERE = Path(__file__).parent
arg = lambda k, d=None: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
SCRIPT = arg("--script", "vo/script_marked.md")
VOICE = arg("--voice", "gemini" if os.environ.get("GEMINI_API_KEY") else "own")
UNTIL = arg("--until", "render")
ORDER = ["plan", "voice", "timeline", "stills", "render"]

def run(label, cmd):
    print(f"\n=== {label}: {' '.join(cmd)}", flush=True)
    r = subprocess.run(cmd)
    if r.returncode:
        print(f"\nFAIL at step '{label}' (exit {r.returncode}). Fix this, then re-run: the finished steps are cached.")
        sys.exit(r.returncode)
    print(f"PASS: {label}")

py = sys.executable
S = lambda n: str(HERE / n)
def stop(step):
    if UNTIL == step:
        print(f"\nStopped after '{step}' as asked (--until {step}). Look at the output, then run again without --until."); sys.exit(0)

if not Path(SCRIPT).exists(): sys.exit(f"missing {SCRIPT}")
run("plan", [py, S("build_timeline.py"), SCRIPT, "--dry-run"]); stop("plan")

voice = Path("public/vo/voice.mp3")
if VOICE == "gemini":
    if not os.environ.get("GEMINI_API_KEY"): sys.exit("GEMINI_API_KEY not set: get a free key in Google AI Studio, or use --voice own")
    if not Path("vo/voices.json").exists(): run("voices-init", [py, S("tts_gemini.py"), SCRIPT, "--init-voices"])
    run("voice", [py, S("tts_gemini.py"), SCRIPT])
elif not voice.exists():
    sys.exit("No voice. Put your recording at public/vo/voice.mp3 (or set GEMINI_API_KEY and use --voice gemini). Not using placeholder audio.")
stop("voice")

run("timings", [py, S("align_voice.py"), str(voice), "vo/timings.json"])
run("timeline", [py, S("build_timeline.py"), SCRIPT, "vo/timings.json"])
run("typecheck", ["npm", "run", "typecheck"] if os.name != "nt" else ["npm.cmd", "run", "typecheck"]); stop("timeline")

run("stills", ["node", S("shot_stills.mjs"), "--scale", "0.5"]); stop("stills")
print("\nLOOK at out/stills/sheet.jpg now. If sets/characters look wrong, fix src/film/registry.tsx or src/sets and re-run.")
run("render+qa", [py, S("render.py"), "film", "Film", "out/film", "--minutes", arg("--minutes", "2")])
print("\nDONE only because qa_final.py passed above. Final file: see the path render.py printed (out/film/final.mp4), subtitles: out/subtitles.srt")
