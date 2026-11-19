"""Free TTS (no key) with word timings: pip install edge-tts
    python tts_edge.py script.txt voice.mp3 [vo/timings.json] [--voice en-US-AndrewNeural]
"""
import asyncio, json, sys
from pathlib import Path
import edge_tts

args = [a for a in sys.argv[1:] if not a.startswith("--")]
voice = sys.argv[sys.argv.index("--voice") + 1] if "--voice" in sys.argv else "en-US-AndrewNeural"
if voice in args: args.remove(voice)
text = Path(args[0]).read_text(encoding="utf8")
mp3 = args[1]; out = Path(args[2] if len(args) > 2 else "vo/timings.json"); out.parent.mkdir(parents=True, exist_ok=True)

async def main():
    com = edge_tts.Communicate(text, voice, boundary="WordBoundary")
    words = []
    with open(mp3, "wb") as f:
        async for ch in com.stream():
            if ch["type"] == "audio": f.write(ch["data"])
            elif ch["type"] == "WordBoundary":
                words.append({"w": ch["text"], "t": round(ch["offset"] / 1e7, 3), "end": round((ch["offset"] + ch["duration"]) / 1e7, 3)})
    out.write_text(json.dumps({"turns": [{"turn": 1, "words": words}]}, indent=1), encoding="utf8")
    print(f"{len(words)} words -> {mp3}, {out}")
asyncio.run(main())
