#!/usr/bin/env python3
"""Multi-voice voice-over with Google's Gemini speech models (Google AI Studio, free tier). Natural voices, a different
voice for the narrator, Akira's quips and every character who speaks in quotes.

  0) get a free key: https://aistudio.google.com  ->  "Get API key";   pip install -U google-genai
       Windows PowerShell:  $env:GEMINI_API_KEY="your-key"
  1) python scripts/tts_gemini.py vo/script_marked.md --init-voices        writes vo/voices.json (edit the voices)
  2) python scripts/tts_gemini.py vo/script_marked.md --plan-only          writes the chunks + vo/gemini/speaker_report.txt
       -> READ speaker_report.txt: it shows who speaks every quote. Fix a wrong one in vo/speaker_overrides.json
  3) python scripts/tts_gemini.py vo/script_marked.md                      generates every chunk (resumable) and joins them
       -> public/vo/voice.mp3  (+ vo/voice_manifest.json)
  4) python scripts/align_voice.py public/vo/voice.mp3 vo/timings.json     exact word times (faster-whisper)
  5) python scripts/build_timeline.py vo/script_marked.md vo/timings.json

NO CODE / NO KEY ROUTE (the AI Studio web page):  python scripts/tts_gemini.py vo/script_marked.md --plan-only
  open https://aistudio.google.com/generate-speech, for each vo/gemini/chunk_NNN.txt: paste it, pick the voice(s) listed in
  vo/gemini/CHUNKS.txt, run, download the WAV as vo/gemini/chunk_NNN.wav; when all are there:
       python scripts/tts_gemini.py --assemble vo/gemini

How it speaks: narration in the NARRATOR voice; text inside "quotes" in the voice of whoever says it (found from "says Ned",
"the drover", "you say"... see speaker_report.txt); `> AKIRA` quips in the AKIRA voice. One request = at most 2 voices
(a Gemini limit), so a chunk ends when a 3rd voice would join. Finished chunks are cached: if the free quota runs out,
run the same command later.  --mock makes beeps instead of speech to test the pipeline without a key.
"""
import argparse
import base64
import json
import os
import re
import struct
import subprocess
import sys
import time
import wave
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_timeline as bt  # noqa: E402  (same folder: the marked-script reader)

RATE = 24000
MODELS = ["gemini-2.5-flash-preview-tts", "gemini-2.5-pro-preview-tts", "gemini-3.8-flash-tts"]
DEFAULT_VOICES = {
    "NARRATOR": {"voice": "Charon", "style": ""},
    "AKIRA": {"voice": "Algieba", "style": "dry and deadpan"},
    "YOU": {"voice": "Kore", "style": ""},
    "NED": {"voice": "Algenib", "style": ""},
    "PEG": {"voice": "Sulafat", "style": ""},
    "SAM": {"voice": "Achernar", "style": ""},
    "DROVER": {"voice": "Orus", "style": ""},
    "DAUGHTER": {"voice": "Leda", "style": ""},
    "SON": {"voice": "Puck", "style": ""},
    "GRANDDAUGHTER": {"voice": "Zephyr", "style": ""},
    "BELLMAN": {"voice": "Rasalgethi", "style": ""},
    "VICAR": {"voice": "Iapetus", "style": ""},
    "CROWD": {"voice": "Fenrir", "style": ""},
    "MOTHER": {"voice": "Despina", "style": ""},
    "NEIGHBOUR": {"voice": "Gacrux", "style": ""},
}
SPEECH_VERBS = r"(?:say|says|said|ask|asks|asked|reply|replies|replied|answer|answers|answered|shout|shouts|shouted|call|calls|called|cry|cries|cried|whisper|whispers|whispered|murmur|murmurs|murmured|add|adds|added|mutter|mutters|muttered|snap|snaps|snapped|laugh|laughs|laughed|think|thinks|thought|announce|announces|bellow|bellows|yell|yells|growl|growls|sigh|sighs|sighed|beg|begs|begged|tell|tells|told|offer|offers|offered|insist|insists|nod|nods|continue|continues)"


def sample_rate_note():
    return RATE


# --------------------------------------------------------------------------- segments
def alias_map(items, voices):
    cast = set(voices) - {"NARRATOR", "AKIRA", "YOU"}  # "you" is handled by its own rule: it is never a name to find
    aliases = {c: {c.lower()} for c in cast}
    for it in items:
        for name, par, rest in it.get("pre", []) if it["kind"] in ("para", "akira") else []:
            if name == "ALIAS":
                who, _, ws = rest.partition("=")
                aliases.setdefault(who.strip().upper(), {who.strip().lower()}).update(w.strip().lower() for w in ws.split(",") if w.strip())
            if name == "SET":
                for part in rest.split("|")[2:]:
                    for c in part.split():
                        cid = c.split("@")[0].upper()
                        aliases.setdefault(cid, {cid.lower()})
    # the words people use: "the drover", "the bellman", "the vicar", "the lodger"
    extra = {"DROVER": ["drover"], "BELLMAN": ["bellman", "crier"], "VICAR": ["vicar", "priest", "parson"], "SAM": ["lodger"], "PEG": ["peg"], "MOTHER": ["mother"], "NEIGHBOUR": ["neighbour", "neighbor"]}
    for k, ws in extra.items():
        if k in aliases:
            aliases[k].update(ws)
    return aliases


def find_speaker(narr_before, before, after, aliases, last):
    """who says a quote. narr_before = the narration before it (quotes removed); before/after = raw text around it.
    Order: 'says Ned' after it -> 'Peg says, "' before it -> 'she says' (nearest named person) -> the same speaker as
    the quote right before it. Returns (speaker, sure)."""
    verb = re.compile(r"\b" + SPEECH_VERBS + r"\b", re.I)

    def hit_in(txt, nearest_last):
        out = []
        for cid, ws in aliases.items():
            for w in ws:
                for m in re.finditer(r"\b" + re.escape(w) + r"\b", txt, re.I):
                    out.append((m.start(), cid))
        out.sort()
        if not out:
            return None
        return out[-1][1] if nearest_last else out[0][1]

    clause = re.split(r"[.!?]", after.lstrip(" ,"), maxsplit=1)[0][:70]
    if verb.search(" ".join(clause.split()[:4])):  # the attribution starts right after the quote: 'says Ned', 'you ask', 'the neighbour says'
        clause = " ".join(clause.split()[:6])
        c = hit_in(clause, False)
        if c:
            return c, True
        if re.search(r"\byou\b", clause, re.I):
            return "YOU", True
        if re.search(r"\b(he|she|they)\b", clause, re.I):
            c = hit_in(narr_before[-220:], True)
            return (c, True) if c else (last, False)
    tail = before[-50:]
    if re.search(r"(?:" + SPEECH_VERBS + r")(?:\s+out)?\s*[,:]?\s*$", tail, re.I):
        c = hit_in(before[-130:], True)
        if c:
            return c, True
        if re.search(r"\byou\b", tail, re.I):
            return "YOU", True
    if last and len(before.rsplit('"', 1)[-1].strip()) <= 32:
        return last, True
    return None, False


def segments(items, voices, overrides):
    """-> list of {scene, speaker, text, kind, note}; also the report lines"""
    aliases = alias_map(items, voices)
    segs, report, scene = [], [], 0
    for it in items:
        if it["kind"] not in ("para", "akira"):
            continue
        if any(n == "SET" for n, _, _ in it.get("pre", [])):
            scene += 1
        if it["kind"] == "akira":
            segs.append({"scene": scene, "speaker": "AKIRA", "text": it["text"], "kind": "akira"})
            continue
        parts = re.split(r'(["“][^"“”]+["”])', it["text"])
        last = None
        for i, p in enumerate(parts):
            if not p.strip():
                continue
            if re.fullmatch(r'["“][^"“”]+["”]', p):
                inner = p.strip('"\u201c\u201d').strip()
                before = "".join(parts[:i])
                after = "".join(parts[i + 1:])
                narr_before = " ".join(parts[j] for j in range(0, i, 2))
                if not bt.norm(inner) or inner[0].islower():  # "covered", "thank you": a word in quotes, not speech
                    segs.append({"scene": scene, "speaker": "NARRATOR", "text": p, "kind": "para"})
                    continue
                spk, sure = find_speaker(narr_before, before, after, aliases, last)
                for k, v in overrides.items():
                    if inner.lower().startswith(k.lower()):
                        spk, sure = v.upper(), True
                if spk is None or spk not in voices:
                    sure = False
                    spk = "NARRATOR" if spk is None else spk
                    if spk not in voices:
                        spk = "NARRATOR"
                if spk != "NARRATOR":
                    last = spk
                segs.append({"scene": scene, "speaker": spk, "text": p, "kind": "quote"})
                report.append(f"{'  ' if sure else '??'} {spk:<10} {inner[:80]}")
            else:
                segs.append({"scene": scene, "speaker": "NARRATOR", "text": p.strip(), "kind": "para"})
        segs[-1]["end_para"] = True
    return segs, report


def chunks(segs, max_chars):
    out, cur, who, chars, scene = [], [], [], 0, None
    for s in segs:
        new_scene = scene is not None and s["scene"] != scene
        if cur and (new_scene or (s["speaker"] not in who and len(who) >= 2) or chars + len(s["text"]) > max_chars):
            out.append(cur)
            cur, who, chars = [], [], 0
        cur.append(s)
        scene = s["scene"]
        if s["speaker"] not in who:
            who.append(s["speaker"])
        chars += len(s["text"])
    if cur:
        out.append(cur)
    return out


def turns(chunk):
    """merge consecutive segments of one speaker into a turn (a paragraph break stays a space)"""
    t = []
    for s in chunk:
        if t and t[-1]["speaker"] == s["speaker"]:
            t[-1]["text"] += " " + s["text"]
        else:
            t.append({"speaker": s["speaker"], "text": s["text"]})
    return t


# --------------------------------------------------------------------------- audio
def pcm_of(path):
    raw = Path(path).read_bytes()
    try:
        with wave.open(str(path), "rb") as w:
            ch, sw, fr = w.getnchannels(), w.getsampwidth(), w.getframerate()
            data = w.readframes(w.getnframes())
        if (ch, sw) != (1, 2):
            raise ValueError("need mono 16-bit")
        if fr != RATE:
            data = resample(data, fr, RATE)
        return data
    except wave.Error:
        return raw  # headerless L16 24 kHz mono


def resample(data, src, dst):
    n = len(data) // 2
    s = struct.unpack(f"<{n}h", data[: n * 2])
    m = int(n * dst / src)
    return struct.pack(f"<{m}h", *[s[min(n - 1, int(i * src / dst))] for i in range(m)])


def write_wav(path, pcm):
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(pcm)


def mock_pcm(chunk, voices):
    """beeps (one pitch per voice) lasting as long as 155 wpm of the text: tests the pipeline without a key"""
    import math
    out = bytearray()
    for tr in turns(chunk):
        words = len(tr["text"].split())
        f = 180 + 40 * (sum(map(ord, voices[tr["speaker"]]["voice"])) % 12)
        n = int(RATE * words / 2.6)
        out += struct.pack(f"<{n}h", *[int(5000 * math.sin(2 * math.pi * f * i / RATE) * (0.5 if (i // 2400) % 5 == 0 else 1)) for i in range(n)])
    return bytes(out)


DEFAULT_KEYS = [
    "AQ.Ab8RN6IcaAX8BIBep-3K7tYXAsR0aRwJpMSgT_LyvOjIRMWSdA",
    "AQ.Ab8RN6JfgNOTImpWlA7rniuF5UYMTabWNz6ivAnIfHx3skQ4HA",
    "AQ.Ab8RN6IEA8EoFulTibflzidG2W0Y5xaPmb_93yKTu-PcnRVIGg",
    "AQ.Ab8RN6L5otx_eVBcSbsDdyBPabhh1PQv5uoj9z-QxqZM2eLFLA",
    "AQ.Ab8RN6KNK8FYYoh4O7WEcn9grtDeZoEDd7tQ-goQ4RqEPLHKpg",
]


class KeyManager:
    def __init__(self, keys):
        self.keys = [k.strip() for k in keys if k.strip()]
        self.idx = 0
        self.client = None
        if self.keys:
            self.init_client()

    def init_client(self):
        from google import genai
        k = self.keys[self.idx]
        self.client = genai.Client(api_key=k, http_options={"api_version": "v1beta"})
        print(f"[KeyManager] Using API key {self.idx + 1}/{len(self.keys)} (...{k[-6:]})", flush=True)

    def next_key(self):
        if self.idx + 1 < len(self.keys):
            self.idx += 1
            self.init_client()
            return True
        return False


def call_gemini(key_mgr, models, chunk, voices, tries=4):
    """Generate speech using generate_content (v1beta TTS route, works with multi-speaker & key rotation)."""
    tr = turns(chunk)
    spk = []
    for t in tr:
        if t["speaker"] not in spk:
            spk.append(t["speaker"])

    # Build the prompt text: label each speaker turn when multi-speaker
    if len(spk) == 1:
        prompt_text = " ".join(t["text"] for t in tr)
    else:
        lines = []
        for t in tr:
            lines.append(f'{t["speaker"]}: {t["text"]}')
        prompt_text = "\n".join(lines)

    last_err = None
    for model in models:
        for k in range(tries):
            client = key_mgr.client
            try:
                if len(spk) == 1:
                    speech_cfg = {
                        "voice_config": {
                            "prebuilt_voice_config": {"voice_name": voices[spk[0]]["voice"]}
                        }
                    }
                else:
                    speech_cfg = {
                        "multi_speaker_voice_config": {
                            "speaker_voice_configs": [
                                {
                                    "speaker": s,
                                    "voice_config": {
                                        "prebuilt_voice_config": {"voice_name": voices[s]["voice"]}
                                    }
                                }
                                for s in spk
                            ]
                        }
                    }
                r = client.models.generate_content(
                    model=model,
                    contents=prompt_text,
                    config={
                        "response_modalities": ["AUDIO"],
                        "speech_config": speech_cfg,
                    }
                )
                # Extract PCM/WAV bytes from the response
                part = r.candidates[0].content.parts[0]
                raw = part.inline_data.data
                if isinstance(raw, str):
                    raw += "=" * (-len(raw) % 4)
                    raw = base64.b64decode(raw)
                return raw, model
            except AttributeError as e:
                sys.exit(f"your google-genai is too old for the speech API ({e}). Run: pip install -U google-genai")
            except Exception as e:  # noqa: BLE001
                msg = str(e)
                last_err = msg
                if "404" in msg or "NOT_FOUND" in msg or "not found" in msg.lower():
                    break  # try the next model name
                if "429" in msg or "RESOURCE_EXHAUSTED" in msg or "quota" in msg.lower():
                    if key_mgr.next_key():
                        print(f"   [Key rotation] Quota limit hit. Switched to key {key_mgr.idx + 1}/{len(key_mgr.keys)}!", flush=True)
                        continue
                    else:
                        print(f"   [All keys exhausted] All {len(key_mgr.keys)} keys hit quota limit: {msg[:200]}", flush=True)
                        raise RuntimeError(msg)
                print("   error:", msg[:300], flush=True)
                time.sleep(3)
    raise RuntimeError(last_err or "no model worked")


# --------------------------------------------------------------------------- assemble
def assemble(d, out_mp3, gap=0.3, gap_scene=0.9):
    d = Path(d)
    man = json.loads((d / "chunks.json").read_text(encoding="utf8"))
    pcm, offs, t = bytearray(), [], 0.0
    prev_scene = None
    missing = []
    for c in man["chunks"]:
        wav = d / f"chunk_{c['n']:03d}.wav"
        if not wav.exists() or wav.stat().st_size < 1000:
            missing.append(wav.name)
            continue
        g = 0.0 if prev_scene is None else (gap_scene if c["scene"] != prev_scene else gap)
        pcm += b"\x00\x00" * int(RATE * g)
        t += g
        data = pcm_of(wav)
        c["start"] = round(t, 3)
        c["dur"] = round(len(data) / 2 / RATE, 3)
        t += c["dur"]
        pcm += data
        prev_scene = c["scene"]
        words = sum(len(x["text"].split()) for x in c["turns"])
        est = words / 2.6
        flag = "  <-- CHECK: much shorter than the text: the voice may have cut off" if c["dur"] < 0.55 * est else ("  <-- CHECK: much longer than the text" if c["dur"] > 1.9 * est else "")
        print(f"chunk {c['n']:03d}: {c['dur']:6.1f}s for {words} words{flag}")
    if missing:
        sys.exit(f"missing audio for {len(missing)} chunk(s): {', '.join(missing[:6])}... generate or download them first")
    full = d.parent / "voice_full.wav"
    write_wav(full, bytes(pcm))
    out = Path(out_mp3)
    out.parent.mkdir(parents=True, exist_ok=True)
    r = subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(full), "-c:a", "libmp3lame", "-q:a", "2", str(out)])
    if r.returncode:
        sys.exit("ffmpeg failed to write the mp3 (is ffmpeg installed?). The WAV is at " + str(full))
    (d.parent / "voice_manifest.json").write_text(json.dumps(man, indent=1), encoding="utf8")
    print(f"voice: {t / 60:.1f} min -> {out}  (WAV {full})")
    print("next: python scripts/align_voice.py", out, "vo/timings.json")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("script", nargs="?")
    ap.add_argument("--voices", default="vo/voices.json")
    ap.add_argument("--overrides", default="vo/speaker_overrides.json")
    ap.add_argument("--out-dir", default="vo/gemini")
    ap.add_argument("--out", default="public/vo/voice.mp3")
    ap.add_argument("--max-chars", type=int, default=1500, help="text per request (~100 s of speech)")
    ap.add_argument("--init-voices", action="store_true")
    ap.add_argument("--plan-only", action="store_true")
    ap.add_argument("--assemble", metavar="DIR", help="only join DIR/chunk_NNN.wav into the mp3")
    ap.add_argument("--mock", action="store_true")
    ap.add_argument("--model", default=None)
    ap.add_argument("--limit", type=int, default=0, help="generate at most N new chunks this run")
    a = ap.parse_args()

    if a.assemble:
        return assemble(a.assemble, a.out)
    if not a.script:
        sys.exit("give the marked script")
    items = bt.read_script(a.script)
    vp = Path(a.voices)
    if a.init_voices:
        ids = {"NARRATOR", "AKIRA"}
        for it in items:
            for n, _, rest in it.get("pre", []):
                if n == "SET":
                    for part in rest.split("|")[2:]:
                        ids.update(c.split("@")[0].upper() for c in part.split())
        alltext = " ".join(it.get("text", "") for it in items).lower()
        if "your mother" in alltext:
            ids.add("MOTHER")
        if "neighbour" in alltext or "neighbor" in alltext:
            ids.add("NEIGHBOUR")
        v = {k: DEFAULT_VOICES.get(k, {"voice": "Fenrir", "style": ""}) for k in sorted(ids, key=lambda x: (x not in ("NARRATOR", "AKIRA"), x))}
        vp.parent.mkdir(parents=True, exist_ok=True)
        vp.write_text(json.dumps(v, indent=2), encoding="utf8")
        print(f"wrote {vp}: change the voice names (Gemini voices: Charon, Algieba, Kore, Algenib, Sulafat, Achernar, Orus, Leda, Puck, Zephyr, Rasalgethi, Iapetus, Fenrir, Gacrux, Schedar, Despina...). Listen to them in AI Studio first.")
        return
    voices = json.loads(vp.read_text(encoding="utf8")) if vp.exists() else {k: dict(v) for k, v in DEFAULT_VOICES.items()}
    voices.setdefault("NARRATOR", DEFAULT_VOICES["NARRATOR"])
    voices.setdefault("AKIRA", DEFAULT_VOICES["AKIRA"])
    ov = json.loads(Path(a.overrides).read_text(encoding="utf8")) if Path(a.overrides).exists() else {}
    segs, report = segments(items, voices, ov)
    ch = chunks(segs, a.max_chars)
    d = Path(a.out_dir)
    d.mkdir(parents=True, exist_ok=True)
    manifest, listing = [], []
    for n, c in enumerate(ch, 1):
        tr = turns(c)
        spk = []
        for t in tr:
            if t["speaker"] not in spk:
                spk.append(t["speaker"])
        body = "\n".join((f"{t['speaker']}: {t['text']}" if len(spk) > 1 else t["text"]) for t in tr)
        (d / f"chunk_{n:03d}.txt").write_text(body + "\n", encoding="utf8")
        manifest.append({"n": n, "scene": c[0]["scene"], "turns": tr})
        listing.append(f"chunk_{n:03d}  scene {c[0]['scene']:>2}  {sum(len(t['text']) for t in tr):>5} chars  " + (" + ".join(f"{s} = {voices[s]['voice']}" for s in spk)) + ("   [multi-speaker: name the two speakers exactly like this]" if len(spk) > 1 else "   [single speaker]"))
    (d / "chunks.json").write_text(json.dumps({"chunks": manifest}, indent=1), encoding="utf8")
    (d / "CHUNKS.txt").write_text("\n".join(listing) + "\n", encoding="utf8")
    (d / "speaker_report.txt").write_text("Who speaks each quote ('??' = a guess; fix with vo/speaker_overrides.json: {\"first words of the quote\": \"NED\"})\n\n" + "\n".join(report) + "\n", encoding="utf8")
    words = sum(len(s["text"].split()) for s in segs)
    print(f"{len(segs)} segments, {words} words ({words / 155:.1f} min), {len(ch)} requests, {sum(1 for r in report if r.startswith('??'))} uncertain quotes")
    print(f"wrote {d}/chunk_NNN.txt, CHUNKS.txt, speaker_report.txt")
    if a.plan_only:
        return

    key_mgr = None
    if not a.mock:
        env_keys = os.environ.get("GEMINI_API_KEYS")
        if env_keys:
            pool = [k.strip() for k in env_keys.split(",") if k.strip()]
        else:
            single = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
            pool = [single] + [k for k in DEFAULT_KEYS if k != single] if single else DEFAULT_KEYS
        try:
            from google import genai
        except ImportError:
            sys.exit("pip install -U google-genai")
        key_mgr = KeyManager(pool)
    models = [a.model] if a.model else MODELS
    done = 0
    for n, c in enumerate(ch, 1):
        wav = d / f"chunk_{n:03d}.wav"
        if wav.exists() and wav.stat().st_size > 1000:
            continue
        if a.limit and done >= a.limit:
            print(f"--limit {a.limit} reached; run again to continue")
            return
        print(f"chunk {n}/{len(ch)} ...", flush=True)
        if a.mock:
            write_wav(wav, mock_pcm(c, {**voices}))
        else:
            try:
                data, model = call_gemini(key_mgr, models, c, voices)
            except RuntimeError as e:
                print(f"STOPPED at chunk {n}: {str(e)[:300]}\nFinished chunks are saved. Run the same command later (the free quota resets daily) to continue.")
                return
            if data[:4] == b"RIFF":
                wav.write_bytes(data)
            else:
                write_wav(wav, data)
            time.sleep(0.5)
        done += 1
    assemble(d, a.out)


if __name__ == "__main__":
    main()
