#!/usr/bin/env python3
"""Long-form (16:9) planner: a MARKED SCRIPT + word timings  ->  scenes, 3-6 s shots, overlays, SRT.

    # 1) the exact text for the text-to-speech / your own recording (no cues in it)
    python scripts/build_timeline.py vo/script_marked.md --narration vo/narration_clean.txt
    # 2) after you have the voice: vo/timings.json (tts_edge.py or align_voice.py)
    python scripts/build_timeline.py vo/script_marked.md vo/timings.json
    # 2b) no voice yet? a rough plan from word counts (155 words/min), to look at the structure
    python scripts/build_timeline.py vo/script_marked.md --dry-run

Writes src/film/timeline.gen.ts, plan/timeline.json, out/subtitles.srt and prints a pacing report.
Exit code 1 when the plan is not trustworthy (alignment gaps, shots too long, unknown cast...). Do not render then.

MARKED SCRIPT (markdown). Narration = every paragraph that is not a cue line. Cue lines start with ">":
  > SET: S2 | day | YOU@L NED@R PEG@CR        scene change before the NEXT paragraph: set id | mood | cast@slot
  > LABEL top-left: `1834`  /  `33 YEARS OLD`  era label shown with the NEXT paragraph (`/` = new line)
  > FOCUS: NED                                 the next paragraph's close-ups are on NED
  > SHOT: close                                force every shot of the next paragraph (wide|medium|close|hero)
  > ALIAS: SAM = lodger, brass-caster          extra words that mean this character (auto: the id itself)
  > BUBBLE (NED): "SOLD!"                      a speech bubble, placed on the words in the PREVIOUS paragraph
  > AKIRA (deadpan): "Divorce, but with livestock."   a narrator cutaway AFTER the previous paragraph; the quip is
                                               SPOKEN (it is part of the narration text; record it in your own voice)
  > AKIRA (wide-eyed, no words)                a silent reaction card over the last 1.5 s of the previous paragraph
  > END CARD                                   the end card after the last paragraph
Moods: day dusk night cold lamp golden.  Slots: FL L CL C CR R FR BL B BR.
"""
import argparse
import difflib
import json
import re
import sys
from pathlib import Path

FPS = 30
MIN_SHOT, MAX_SHOT = 3.0, 6.5
ZOOM = 0.09
KINDS_AFTER_WIDE = ["medium", "close", "medium", "close", "wide"]
WPS_DRY = 155 / 60.0


def norm(w):
    return re.sub(r"[^a-z0-9'-]", "", w.lower().replace("’", "'")).strip("'-")


def read_script(path):
    lines = Path(path).read_text(encoding="utf8").splitlines()
    # narration = between a heading with NARRATION and the next "## " heading; else the whole file
    start = next((i for i, l in enumerate(lines) if l.startswith("#") and "NARRATION" in l.upper()), None)
    if start is not None:
        end = next((i for i in range(start + 1, len(lines)) if lines[i].startswith("## ")), len(lines))
        lines = lines[start + 1:end]
    items, pending, para = [], [], []

    def flush():
        nonlocal para
        if para:
            items.append({"kind": "para", "text": " ".join(para).strip(), "pre": pending[:]})
            pending.clear()
            para = []

    for raw in lines:
        l = raw.rstrip()
        if l.strip() in ("", "---"):
            flush()
            continue
        if l.startswith("#"):
            flush()
            continue
        if l.startswith(">"):
            flush()
            cue = l[1:].strip()
            if cue.startswith("LABEL"):  # "LABEL top-left: `1801`": the words before the colon are a position, not a name
                pending.append(("LABEL", "", cue[5:].strip()))
                continue
            m = re.match(r"([A-Z][A-Z ]*?)\s*(?:\(([^)]*)\))?\s*(?::\s*(.*))?$", cue)
            if not m:  # a plain note such as '> Lines starting with ">" are cues': ignored
                continue
            name, par, rest = m.group(1).strip(), (m.group(2) or "").strip(), (m.group(3) or "").strip()
            if name in ("SET", "LABEL", "FOCUS", "SHOT", "ALIAS"):
                pending.append((name, par, rest))
            elif name in ("BUBBLE", "AKIRA", "END CARD"):
                q = re.search(r'["“](.*?)["”]', rest)
                text = q.group(1).strip() if q else ""
                if name == "AKIRA":
                    # spoken quip = its own paragraph in the narration; silent = overlay only
                    if text:
                        items.append({"kind": "akira", "text": text, "mood": par or "deadpan", "pre": pending[:]})
                        pending.clear()
                    else:
                        items.append({"kind": "akira_silent", "text": "", "mood": par.split(",")[0].strip() or "wide-eyed"})
                elif name == "BUBBLE":
                    items.append({"kind": "bubble", "text": text, "who": par})
                else:
                    items.append({"kind": "end", "text": text})
            else:
                sys.exit(f"unknown cue '{name}': {l}")
            continue
        para.append(l.strip())
    flush()
    return items


def spoken(items):
    return [it for it in items if it["kind"] in ("para", "akira")]


def tokens(text):
    out = []
    for raw in text.split():
        n = norm(raw)
        if n:
            out.append((raw, n))
    return out


def load_words(p):
    ws = []
    for tr in json.loads(Path(p).read_text(encoding="utf8"))["turns"]:
        for w in tr["words"]:
            n = norm(w["w"])
            if n:
                ws.append({"w": w["w"], "n": n, "t": float(w["t"]), "end": float(w["end"])})
    if not ws:
        sys.exit("no words in timings file")
    return ws


def synthetic_words(sp):
    ws, t = [], 0.0
    for it in sp:
        for raw, n in tokens(it["text"]):
            d = 0.12 + 0.045 * len(n)
            ws.append({"w": raw, "n": n, "t": round(t, 3), "end": round(t + d, 3)})
            t += d + (0.25 if re.search(r"[.?!]$", raw) else 0.1 if raw.endswith(",") else 0.0)
        t += 0.55
    return ws


def align(sp, words):
    """per spoken paragraph: a time for every token (monotonic fuzzy alignment, interpolating the gaps)"""
    ptoks = [tokens(it["text"]) for it in sp]
    total = sum(len(p) for p in ptoks) or 1
    starts, ptr, done, weak = [], 0, 0, 0
    for p in ptoks:
        est = int(round(done / total * len(words)))
        best = None
        for off in range(0, min(6, max(1, len(p) - 1))):  # try the first words, then a few words in (hyphenated numbers etc.)
            want = [n for _, n in p[off:off + 3]]
            for lo, hi in ((ptr, ptr + 220), (max(ptr, est - 150), est + 150)):
                for i in range(lo, min(len(words) - 1, hi)):
                    hit = sum(1 for k, n in enumerate(want) if i + k < len(words) and words[i + k]["n"] == n)
                    if hit >= min(2, len(want)):
                        best = max(ptr, i - off)
                        break
                if best is not None:
                    break
            if best is not None:
                break
        if best is None:
            best = max(ptr, min(est, len(words) - 1))
            weak += 1
        starts.append(best)
        ptr = best + max(1, len(p) // 2)
        done += len(p)
    starts_s = []
    for i, s in enumerate(starts):  # keep strictly increasing
        starts_s.append(max(s, (starts_s[-1] + 1) if starts_s else 0))
    out = []
    for i, p in enumerate(ptoks):
        a = starts_s[i]
        b = starts_s[i + 1] if i + 1 < len(starts_s) else len(words)
        win = words[a:b]
        sm = difflib.SequenceMatcher(None, [n for _, n in p], [w["n"] for w in win], autojunk=False)
        tm = [None] * len(p)
        for blk in sm.get_matching_blocks():
            for k in range(blk.size):
                tm[blk.a + k] = (win[blk.b + k]["t"], win[blk.b + k]["end"])
        matched = sum(1 for x in tm if x)
        if matched < 0.6 * len(p) and len(p) >= 6:
            weak += 1
        # interpolate gaps
        idx = [k for k, x in enumerate(tm) if x]
        if not idx:
            t0 = win[0]["t"] if win else words[-1]["t"]
            t1 = win[-1]["end"] if win else words[-1]["end"]
            tm = [(t0 + (t1 - t0) * k / max(1, len(p)), t0 + (t1 - t0) * (k + 1) / max(1, len(p))) for k in range(len(p))]
        else:
            for k in range(len(p)):
                if tm[k]:
                    continue
                lo = max([j for j in idx if j < k], default=None)
                hi = min([j for j in idx if j > k], default=None)
                if lo is None:
                    tm[k] = (tm[hi][0], tm[hi][0])
                elif hi is None:
                    tm[k] = (tm[lo][1], tm[lo][1])
                else:
                    u = (k - lo) / (hi - lo)
                    x = tm[lo][1] + (tm[hi][0] - tm[lo][1]) * u
                    tm[k] = (x, x)
        out.append([{"raw": r, "n": n, "t": tm[k][0], "end": max(tm[k][1], tm[k][0])} for k, (r, n) in enumerate(p)])
    return out, weak


def sentences(toks):
    out, cur = [], []
    for tk in toks:
        cur.append(tk)
        if re.search(r"[.?!][\"'”’)]*$", tk["raw"]):
            out.append(cur)
            cur = []
    if cur:
        out.append(cur)
    return out


def split_long(sent, limit):
    """split a sentence longer than `limit` s at commas / the middle"""
    if sent[-1]["end"] - sent[0]["t"] <= limit or len(sent) < 8:
        return [sent]
    cuts = [i + 1 for i, tk in enumerate(sent[:-3]) if i >= 3 and re.search(r"[,;:—]$", tk["raw"])]
    mid = (sent[0]["t"] + sent[-1]["end"]) / 2
    cut = min(cuts, key=lambda i: abs(sent[i]["t"] - mid)) if cuts else len(sent) // 2
    return split_long(sent[:cut], limit) + split_long(sent[cut:], limit)


def parse_cast(s):
    out = []
    for part in s.split():
        if "@" in part:
            n, slot = part.split("@", 1)
        else:
            n, slot = part, "C"
        out.append({"id": n.upper(), "slot": slot.upper()})
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("script")
    ap.add_argument("timings", nargs="?")
    ap.add_argument("--narration", help="write the clean narration text for TTS / recording, then exit")
    ap.add_argument("--dry-run", action="store_true", help="synthetic timings (155 wpm) to preview the structure")
    ap.add_argument("--out-ts", default="src/film/timeline.gen.ts")
    ap.add_argument("--out-json", default="plan/timeline.json")
    ap.add_argument("--out-srt", default="out/subtitles.srt")
    ap.add_argument("--fps", type=int, default=FPS)
    ap.add_argument("--title", default="")
    ap.add_argument("--tail", type=float, default=4.0, help="seconds of end card after the last word")
    a = ap.parse_args()

    items = read_script(a.script)
    sp = spoken(items)
    if a.narration:
        Path(a.narration).parent.mkdir(parents=True, exist_ok=True)
        Path(a.narration).write_text("\n\n".join(it["text"] for it in sp) + "\n", encoding="utf8")
        n = sum(len(tokens(it["text"])) for it in sp)
        print(f"narration: {len(sp)} paragraphs, {n} words (~{n / 155:.1f} min at 155 wpm) -> {a.narration}")
        return
    if not a.timings and not a.dry_run:
        sys.exit("give vo/timings.json, or --dry-run")
    words = synthetic_words(sp) if a.dry_run else load_words(a.timings)
    tl, weak = align(sp, words)
    problems = []
    if weak and not a.dry_run:
        problems.append(f"{weak} paragraph(s) aligned weakly: is vo/timings.json made from THIS narration text? (build_timeline.py --narration)")

    # ---- times per spoken item ----
    pt = {}  # item index -> (start, end, tokens)
    k = 0
    for i, it in enumerate(items):
        if it["kind"] in ("para", "akira"):
            toks = tl[k]
            k += 1
            pt[i] = (toks[0]["t"], toks[-1]["end"], toks)
    spoken_idx = sorted(pt)
    last_end = pt[spoken_idx[-1]][1]
    duration = round(last_end + a.tail, 2)

    # ---- scenes, labels, focus (cues that look FORWARD attach to the next paragraph) ----
    scenes, events, aliases = [], [], {}
    cur = None
    para_scene, para_focus, para_force = {}, {}, {}
    for i in spoken_idx:
        it = items[i]
        t0 = pt[i][0]
        for name, par, rest in it.get("pre", []):
            if name == "SET":
                bits = [b.strip() for b in rest.split("|")]
                if len(bits) < 2:
                    problems.append(f"SET cue needs 'id | mood | cast': {rest}")
                    continue
                cur = {"id": f"{len(scenes) + 1:02d}", "set": bits[0], "mood": bits[1], "start": t0, "cast": parse_cast(bits[2]) if len(bits) > 2 else []}
                scenes.append(cur)
            elif name == "LABEL":
                txt = re.findall(r"`([^`]*)`", rest)
                pos = "top-center" if "cent" in (par + rest.split(":")[0]).lower() else "top-left"
                head = rest.split("`")[0].lower()
                if "center" in head or "centre" in head:
                    pos = "top-center"
                events.append({"type": "label", "start": round(t0 + 0.3, 2), "end": round(t0 + 4.8, 2), "text": " / ".join(txt) if txt else rest, "pos": pos})
            elif name == "FOCUS":
                para_focus[i] = rest.strip().upper()
            elif name == "SHOT":
                para_force[i] = rest.strip().lower()
            elif name == "ALIAS":
                who, _, words_ = rest.partition("=")
                aliases[who.strip().upper()] = [w.strip().lower() for w in words_.split(",") if w.strip()]
        if cur is None:
            problems.append("the script must start with a '> SET:' cue before the first paragraph")
            cur = {"id": "01", "set": "?", "mood": "day", "start": t0, "cast": []}
            scenes.append(cur)
        para_scene[i] = len(scenes) - 1
    for j, sc in enumerate(scenes):
        sc["end"] = scenes[j + 1]["start"] if j + 1 < len(scenes) else duration
        sc["start"] = round(sc["start"] if j else 0.0, 2)
        sc["end"] = round(sc["end"], 2)

    # ---- bubbles / akira overlays (cues that look BACK attach to the previous spoken paragraph) ----
    prev = None
    for i, it in enumerate(items):
        if i in pt:
            prev = i
        if it["kind"] == "bubble":
            if prev is None:
                problems.append(f"bubble before any paragraph: {it['text']}")
                continue
            want = [norm(x) for x in it["text"].split() if norm(x)]
            toks = pt[prev][2]
            hit = None
            for s in range(len(toks) - len(want) + 1 if want else 0):
                if [t["n"] for t in toks[s:s + len(want)]] == want:
                    hit = toks[s]["t"]
            if hit is None:  # not literally spoken: show it on the last sentence
                ss = sentences(toks)
                hit = ss[-1][0]["t"]
            events.append({"type": "bubble", "start": round(hit, 2), "end": round(hit + 2.4, 2), "text": it["text"].upper(), "who": it["who"].upper()})
        elif it["kind"] == "akira" and i in pt:
            events.append({"type": "akira", "start": round(pt[i][0] - 0.1, 2), "end": round(pt[i][1] + 0.35, 2), "text": it["text"], "mood": it["mood"]})
        elif it["kind"] == "akira_silent" and prev is not None:
            e = pt[prev][1]
            events.append({"type": "akira", "start": round(e - 1.5, 2), "end": round(e + 0.2, 2), "text": "", "mood": it["mood"]})
        elif it["kind"] == "end":
            events.append({"type": "endcard", "start": round(last_end + 0.8, 2), "end": duration, "text": it["text"] or "THE END"})
    if not any(e["type"] == "endcard" for e in events):
        events.append({"type": "endcard", "start": round(last_end + 0.8, 2), "end": duration, "text": "THE END"})

    # ---- name tags the first time a non-YOU character appears ----
    seen = set()
    for sc in scenes:
        for c in sc["cast"]:
            if c["id"] not in seen and c["id"] != "YOU":
                seen.add(c["id"])
                events.append({"type": "tag", "start": round(sc["start"] + 0.6, 2), "end": round(sc["start"] + 4.6, 2), "text": c["id"], "who": c["id"]})

    # ---- shots ----
    CUTAWAYS_MAP = {
        "S1": [
            ("buckles", ["buckle", "buckles", "polish", "polishes", "finished ones", "candlelight", "kitchen table", "family business"]),
            ("tin_box", ["secret", "penny", "pence", "floorboards", "floorboard"]),
        ],
        "S2": [
            ("halter", ["halter", "rope", "straw rope", "neck", "leading", "led", "cattle-halter"]),
            ("coins", ["shilling", "shillings", "nine shillings", "ten shillings", "five shillings", "twenty shillings", "forty shillings", "pence", "penny", "bid", "bids", "sold", "money", "half-crown", "cost"]),
            ("cattle", ["cattle", "livestock", "hurdles", "beasts", "pens", "cow", "cows", "bull ring"]),
            ("cabbages", ["cabbage", "cabbages", "apples", "market at the heart", "potatoes", "vegetables", "produce"]),
        ],
        "S3": [
            ("church_altar", ["church", "altar", "wedding", "coverture", "register", "vows", "reverend", "parish", "st martin", "cross", "bells"]),
        ],
        "S4": [
            ("hammer", ["hammer", "forty men hammer", "metal", "tiny bits of metal", "anvil", "filings", "forge", "workshop"]),
            ("buckles", ["buckle", "buckles", "finished ones", "journeyman"]),
        ],
        "S5": [
            ("meat_pie", ["pie", "pies", "peas", "hot pies", "crust", "mutton", "baking", "gravy", "gingerbread", "step"]),
        ],
        "S6": [
            ("ale_mug", ["ale", "tankard", "tankards", "beer", "pub", "tavern", "drink", "pints", "counter", "table", "inn"]),
            ("coins", ["shilling", "shillings", "pence", "penny", "money", "paid", "toll", "spent"]),
        ],
        "S7": [
            ("tin_box", ["tin box", "floorboard", "floorboards", "secret", "savings", "hidden", "trunk", "sovereigns", "tin", "attic", "straw pallet", "pallet"]),
        ],
    }

    shots = []
    for si, sc in enumerate(scenes):
        cast_ids = [c["id"] for c in sc["cast"]]
        spans = []
        for i in spoken_idx:
            if para_scene[i] != si or items[i]["kind"] != "para":
                continue
            toks = pt[i][2]
            raw_s = [s for sent in sentences(toks) for s in split_long(sent, MAX_SHOT)]
            grp, g0 = [], None
            chunks = []
            for s in raw_s:
                if grp and s[-1]["end"] - grp[0][0]["t"] > MAX_SHOT and grp[-1][-1]["end"] - grp[0][0]["t"] >= 1.5:
                    chunks.append(grp)  # adding this sentence would make the hold too long: cut before it
                    grp = []
                grp.append(s)
                g0 = grp[0][0]["t"]
                if s[-1]["end"] - g0 >= MIN_SHOT:
                    chunks.append(grp)
                    grp = []
            if grp:
                if chunks and (grp[-1][-1]["end"] - grp[0][0]["t"]) < 1.6:
                    chunks[-1].extend(grp)
                else:
                    chunks.append(grp)
            for ch in chunks:
                text = " ".join(t["raw"] for s in ch for t in s)
                spans.append({"start": ch[0][0]["t"], "end": ch[-1][-1]["end"], "text": text, "para": i})
        for n, sp_ in enumerate(spans):
            i = sp_["para"]
            kind = para_force.get(i) or ("wide" if n == 0 else KINDS_AFTER_WIDE[(n - 1) % len(KINDS_AFTER_WIDE)])
            subj = para_focus.get(i)
            low_text = sp_["text"].lower()
            if not subj:
                named = [c for c in cast_ids if c != "YOU" and (re.search(r"\b" + re.escape(c.lower()) + r"\b", low_text) or any(re.search(r"\b" + re.escape(w) + r"\b", low_text) for w in aliases.get(c, [])))]
                subj = named[0] if named else ("YOU" if "YOU" in cast_ids else (cast_ids[0] if cast_ids else "YOU"))
            if cast_ids and subj not in cast_ids:
                problems.append(f"scene {sc['id']}: focus '{subj}' is not in the cast {cast_ids}")

            # Narration-matched prop & environment cutaway
            cutaway = None
            if kind in ("medium", "close") and n > 0:
                for cut_name, keywords in CUTAWAYS_MAP.get(sc["set"], []):
                    if any(re.search(r"\b" + re.escape(k) + r"\b", low_text) for k in keywords):
                        cutaway = cut_name
                        break

            # Zero-frozen kinetic camera move & non-zero zoom
            is_shock = bool(re.search(r"\b(sold|nine shillings|ten shillings|coverture|disappointed|divorce|hundreds of pounds)\b|[!?]", low_text))
            if is_shock:
                move = "PUNCH"
                zoom = 0.12
            elif n % 5 == 0:
                move = "PUSH"
                zoom = 0.09
            elif n % 5 == 1:
                move = "PULL"
                zoom = -0.07
            elif n % 5 == 2:
                move = "PAN"
                zoom = 0.06
            elif n % 5 == 3:
                move = "ORBIT"
                zoom = 0.08
            else:
                move = "WHIP"
                zoom = 0.07

            shot_rec = {
                "scene": si,
                "start": sp_["start"],
                "end": sp_["end"],
                "kind": kind,
                "subject": subj,
                "zoom": zoom,
                "side": 26 if n % 2 == 0 else -26,
                "move": move,
                "text": sp_["text"],
            }
            if cutaway:
                shot_rec["cutaway"] = cutaway
            shots.append(shot_rec)
        if not spans:
            problems.append(f"scene {sc['id']} has no narration")
    # shots tile each scene with no gaps (an Akira cutaway or a pause is covered by the shot before it)
    filler = []
    for si, sc in enumerate(scenes):
        mine = [s for s in shots if s["scene"] == si]
        for j, s in enumerate(mine):
            s["start"] = sc["start"] if j == 0 else mine[j]["start"]
            nxt = mine[j + 1]["start"] if j + 1 < len(mine) else sc["end"]
            if nxt - s["end"] > 1.2:  # a spoken Akira quip sits here: its own hold, hidden under the card
                filler.append({**s, "start": s["end"], "end": nxt, "zoom": 0.06, "move": "PUSH", "kind": "medium"})
            else:
                s["end"] = nxt
    shots.extend(filler)
    shots.sort(key=lambda x: (x["scene"], x["start"]))
    for s in shots:
        s["start"], s["end"] = round(s["start"], 2), round(s["end"], 2)

    # Enforce user rule: no shot longer than 6.5s + continuous non-zero motion
    capped_shots = []
    for s in shots:
        dur = s["end"] - s["start"]
        if dur > MAX_SHOT:
            pieces = int(dur // MAX_SHOT) + 1
            sub_dur = dur / pieces
            for p in range(pieces):
                st = round(s["start"] + p * sub_dur, 2)
                en = round(s["start"] + (p + 1) * sub_dur, 2)
                sub_kind = s["kind"] if p == 0 else ("close" if s["kind"] == "medium" else ("medium" if s["kind"] == "wide" else "medium"))
                sub_move = s.get("move", "PUSH") if p == 0 else ("PULL" if p == 1 else "PAN")
                sub_zoom = s.get("zoom", 0.08) if p == 0 else ((-0.06) if p == 1 else 0.07)
                capped_shots.append({**s, "start": st, "end": en, "kind": sub_kind, "move": sub_move, "zoom": sub_zoom})
        else:
            capped_shots.append(s)
    shots = capped_shots
    shots.sort(key=lambda x: (x["scene"], x["start"]))

    # ---- report ----
    lens = [s["end"] - s["start"] for s in shots]
    over = [s for s in shots if s["end"] - s["start"] > 8.5]
    short = [s for s in shots if s["end"] - s["start"] < 1.5]
    kinds = {k_: sum(1 for s in shots if s["kind"] == k_) for k_ in ("wide", "medium", "close", "hero")}
    print(f"duration {duration:.1f}s ({duration / 60:.1f} min) | scenes {len(scenes)} | shots {len(shots)} | words {len(words)}")
    print(f"shot length: mean {sum(lens) / len(lens):.1f}s  min {min(lens):.1f}  max {max(lens):.1f} | kinds {kinds} | zoom shots {sum(1 for s in shots if s['zoom'])}")
    for sc in scenes:
        print(f"  scene {sc['id']} {sc['set']:<10} {sc['mood']:<7} {sc['start']:7.1f}-{sc['end']:7.1f}s  cast {[c['id'] + '@' + c['slot'] for c in sc['cast']]}")
    if over:
        problems.append(f"{len(over)} shot(s) hold longer than 8.5 s (first at {over[0]['start']}s): add a SHOT/FOCUS cue or split the paragraph")
    if len(short) > max(3, len(shots) // 10):
        problems.append(f"{len(short)} shots are shorter than 1.5 s")
    if duration < 20 * 60 * 0.5 and not a.dry_run:
        pass

    tlj = {"fps": a.fps, "duration": duration, "title": a.title, "scenes": scenes, "shots": shots, "events": sorted(events, key=lambda e: e["start"])}
    Path(a.out_json).parent.mkdir(parents=True, exist_ok=True)
    Path(a.out_json).write_text(json.dumps(tlj, indent=1), encoding="utf8")
    Path(a.out_ts).parent.mkdir(parents=True, exist_ok=True)
    Path(a.out_ts).write_text(
        "// GENERATED by scripts/build_timeline.py. Do not edit; change the marked script and re-run.\n"
        'import type { Timeline } from "./types";\n\n'
        f"export const TIMELINE: Timeline = {json.dumps(tlj, indent=1)};\n",
        encoding="utf8",
    )

    # ---- SRT (long-form ships subtitles instead of burned-in captions) ----
    def ts(x):
        ms = int(round(x * 1000))
        return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"

    cues = []
    for i in spoken_idx:
        for sent in sentences(pt[i][2]):
            buf = []
            for tk in sent:
                buf.append(tk)
                if len(" ".join(x["raw"] for x in buf)) >= 70 and re.search(r"[,;:.?!]$", tk["raw"]) or len(" ".join(x["raw"] for x in buf)) >= 90:
                    cues.append(buf)
                    buf = []
            if buf:
                cues.append(buf)
    Path(a.out_srt).parent.mkdir(parents=True, exist_ok=True)
    Path(a.out_srt).write_text(
        "\n".join(f"{n + 1}\n{ts(c[0]['t'])} --> {ts(max(c[-1]['end'], c[0]['t'] + 0.6))}\n{' '.join(x['raw'] for x in c)}\n" for n, c in enumerate(cues)),
        encoding="utf8",
    )
    print(f"wrote {a.out_ts}, {a.out_json}, {a.out_srt} ({len(cues)} subtitle cues)")
    if a.dry_run:
        print("DRY RUN: times are estimates. Re-run with the real vo/timings.json before rendering.")
    if problems:
        print("\nPROBLEMS (fix before rendering):")
        for p in problems:
            print("  -", p)
        sys.exit(1)
    print("plan OK")


if __name__ == "__main__":
    main()
