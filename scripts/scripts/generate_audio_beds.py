#!/usr/bin/env python3
"""Generate authentic ambient soundscapes and SFX for 'Why It Sucks to Be a Wife Sold at a Market'."""
import os, math, wave, struct, random
from pathlib import Path

OUT_DIR = Path("public/audio")
OUT_DIR.mkdir(parents=True, exist_ok=True)
SAMPLE_RATE = 44100

def write_wav(path, samples):
    with wave.open(str(path), 'w') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        raw = bytearray()
        for s in samples:
            val = max(-32767, min(32767, int(s * 32767)))
            raw.extend(struct.pack('<h', val))
        wf.writeframes(raw)

def pink_noise(n, seed=42):
    random.seed(seed)
    out = [0.0] * n
    b0 = b1 = b2 = b3 = b4 = b5 = b6 = 0.0
    for i in range(n):
        white = random.uniform(-1, 1)
        b0 = 0.99886 * b0 + white * 0.0555179
        b1 = 0.99332 * b1 + white * 0.0750759
        b2 = 0.96900 * b2 + white * 0.1538520
        b3 = 0.86650 * b3 + white * 0.3104856
        b4 = 0.55000 * b4 + white * 0.5329522
        b5 = -0.7616 * b5 - white * 0.0168980
        out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11
        b6 = white * 0.115926
    return out

# 1. Market Ambient (S2 Bull Ring) - 10s loop
def gen_market():
    dur = 10.0
    n = int(dur * SAMPLE_RATE)
    noise = pink_noise(n, seed=101)
    samples = [0.0] * n
    for i in range(n):
        t = i / SAMPLE_RATE
        formant = (math.sin(2 * math.pi * 180 * t + math.sin(t * 2.5) * 1.5) * 0.05 +
                   math.sin(2 * math.pi * 360 * t + math.cos(t * 3.1) * 2.0) * 0.04 +
                   math.sin(2 * math.pi * 540 * t) * 0.02) * (0.7 + 0.3 * math.sin(t * 1.8))
        samples[i] = (noise[i] * 0.6 + formant) * 0.45
    write_wav(OUT_DIR / "ambient_market.wav", samples)

# 2. Church Ambient (S3 St. Martins) - 10s loop
def gen_church():
    dur = 10.0
    n = int(dur * SAMPLE_RATE)
    noise = pink_noise(n, seed=202)
    samples = [0.0] * n
    for i in range(n):
        t = i / SAMPLE_RATE
        # resonant stone hall air + deep low chime harmonic
        bell = (math.sin(2 * math.pi * 130.81 * t) * 0.06 +
                math.sin(2 * math.pi * 261.63 * t) * 0.04 +
                math.sin(2 * math.pi * 392.00 * t) * 0.02) * (0.5 + 0.5 * math.cos(t * 0.6))
        samples[i] = (noise[i] * 0.4 + bell) * 0.35
    write_wav(OUT_DIR / "ambient_church.wav", samples)

# 3. Workshop Ambient (S4 Workshop) - 10s loop
def gen_workshop():
    dur = 10.0
    n = int(dur * SAMPLE_RATE)
    noise = pink_noise(n, seed=303)
    samples = [0.0] * n
    for i in range(n):
        t = i / SAMPLE_RATE
        # muffled rhythmic hammer cadence every 1.25s
        hit_phase = (t % 1.25)
        strike = math.sin(2 * math.pi * 880 * hit_phase) * math.exp(-hit_phase * 18) * 0.12 if hit_phase < 0.3 else 0.0
        samples[i] = (noise[i] * 0.5 + strike) * 0.38
    write_wav(OUT_DIR / "ambient_workshop.wav", samples)

# 4. Pub Ambient (S6 Pub) - 10s loop
def gen_pub():
    dur = 10.0
    n = int(dur * SAMPLE_RATE)
    noise = pink_noise(n, seed=404)
    samples = [0.0] * n
    for i in range(n):
        t = i / SAMPLE_RATE
        clink_phase = (t % 2.7)
        glass = math.sin(2 * math.pi * 1760 * clink_phase) * math.exp(-clink_phase * 24) * 0.08 if clink_phase < 0.2 else 0.0
        murmur = math.sin(2 * math.pi * 240 * t) * 0.04 * (0.8 + 0.2 * math.sin(t * 4))
        samples[i] = (noise[i] * 0.5 + glass + murmur) * 0.4
    write_wav(OUT_DIR / "ambient_pub.wav", samples)

# 5. Room / Attic / Kitchen (S1, S7) - 10s loop
def gen_room():
    dur = 10.0
    n = int(dur * SAMPLE_RATE)
    noise = pink_noise(n, seed=505)
    samples = [noise[i] * 0.28 for i in range(n)]
    write_wav(OUT_DIR / "ambient_room.wav", samples)

# 6. Lane / Outdoor BackStep (S5) - 10s loop
def gen_lane():
    dur = 10.0
    n = int(dur * SAMPLE_RATE)
    noise = pink_noise(n, seed=606)
    samples = [0.0] * n
    for i in range(n):
        t = i / SAMPLE_RATE
        breeze = (0.7 + 0.3 * math.sin(t * 0.8))
        samples[i] = noise[i] * 0.32 * breeze
    write_wav(OUT_DIR / "ambient_lane.wav", samples)

# 7. Auction Gavel Strike SFX (Impact on "SOLD!", bids) - 0.6s
def gen_gavel():
    dur = 0.65
    n = int(dur * SAMPLE_RATE)
    samples = [0.0] * n
    random.seed(707)
    for i in range(n):
        t = i / SAMPLE_RATE
        # Solid wooden block strike: heavy thud transient + resonant wood ring
        transient = random.uniform(-1, 1) * math.exp(-t * 80) * 0.6
        thud = math.sin(2 * math.pi * 95 * t) * math.exp(-t * 22) * 0.5
        body = math.sin(2 * math.pi * 220 * t) * math.exp(-t * 14) * 0.35
        samples[i] = transient + thud + body
    write_wav(OUT_DIR / "sfx_gavel.wav", samples)

# 8. Cinematic Whoosh / Pan Transition SFX - 0.4s
def gen_whoosh():
    dur = 0.45
    n = int(dur * SAMPLE_RATE)
    samples = [0.0] * n
    random.seed(808)
    for i in range(n):
        t = i / SAMPLE_RATE
        env = math.sin(math.pi * (t / dur)) ** 2
        f = 200 + 1200 * (t / dur)
        samples[i] = random.uniform(-1, 1) * env * 0.45 + math.sin(2 * math.pi * f * t) * env * 0.15
    write_wav(OUT_DIR / "sfx_whoosh.wav", samples)

if __name__ == "__main__":
    gen_market()
    gen_church()
    gen_workshop()
    gen_pub()
    gen_room()
    gen_lane()
    gen_gavel()
    gen_whoosh()
    print("All audio beds and SFX generated cleanly in public/audio/")
