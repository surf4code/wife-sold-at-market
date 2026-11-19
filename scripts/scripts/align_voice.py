"""Voice-over -> vo/timings.json (word timings) with free local faster-whisper (CPU) or voice_manifest.json fallback.
    pip install faster-whisper
    python align_voice.py voice.mp3 [vo/timings.json] [--model base.en]
Output: {"turns":[{"turn":1,"words":[{"w":"Hello","t":0.12,"end":0.48},...]}]}  (one turn = whole voice-over)
"""
import json, re, sys
from pathlib import Path

args = [a for a in sys.argv[1:] if not a.startswith("--")]
model_name = sys.argv[sys.argv.index("--model") + 1] if "--model" in sys.argv else "base.en"
if model_name in args: args.remove(model_name)
src = args[0]
out = Path(args[1] if len(args) > 1 else "vo/timings.json")
out.parent.mkdir(parents=True, exist_ok=True)

words = []
try:
    from faster_whisper import WhisperModel
    segs, _ = WhisperModel(model_name, device="cpu", compute_type="int8").transcribe(src, word_timestamps=True, vad_filter=True)
    words = [{"w": w.word.strip(), "t": round(w.start, 3), "end": round(w.end, 3)} for s in segs for w in s.words]
except Exception as e:
    print(f"faster-whisper not available ({e}), aligning from voice_manifest.json...")
    man_path = Path("vo/voice_manifest.json")
    if not man_path.exists():
        sys.exit(f"Cannot align: faster_whisper failed and {man_path} does not exist.")
    man = json.loads(man_path.read_text(encoding="utf8"))
    for c in man["chunks"]:
        c_start = c["start"]
        c_dur = c["dur"]
        all_toks = []
        for tr in c["turns"]:
            for raw in tr["text"].split():
                raw_clean = raw.strip()
                if raw_clean:
                    w = 0.12 + 0.045 * len(raw_clean)
                    if re.search(r"[.?!]$", raw_clean): w += 0.25
                    elif raw_clean.endswith(","): w += 0.1
                    all_toks.append((raw_clean, w))
        total_w = sum(w for _, w in all_toks) or 1.0
        scale = c_dur / total_w
        cur_t = c_start
        for raw_clean, w in all_toks:
            dur_w = w * scale
            words.append({"w": raw_clean, "t": round(cur_t, 3), "end": round(cur_t + dur_w, 3)})
            cur_t += dur_w

out.write_text(json.dumps({"turns": [{"turn": 1, "words": words}]}, indent=1), encoding="utf8")
print(f"{len(words)} words, {words[-1]['end']:.1f}s -> {out}")
