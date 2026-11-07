"""Render original grill-bar instrumentals. Requires numpy and lameenc.

No recordings, borrowed melodies, external samples or model services are used.
Run with Python 3: python scripts/compose-jukebox.py
"""
from pathlib import Path
import json
import math
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.tmp' / 'music-tools'))
import numpy as np
import lameenc

SR = 32000
DEST = ROOT / 'public' / 'music' / 'jukebox'
TRACKS = [
    ('last-booth-blues', 'Last Booth Blues', 'home', 78, 45, False, 36, 101),
    ('neon-after-midnight', 'Neon After Midnight', 'home', 72, 50, True, 32, 202),
    ('grease-stained-45', 'Grease-stained 45', 'roster', 94, 40, False, 36, 303),
    ('chrome-and-coffee', 'Chrome & Coffee', 'roster', 96, 48, False, 36, 404),
    ('quarter-slot-shuffle', 'Quarter Slot Shuffle', 'battle', 108, 43, False, 36, 505),
    ('backroom-boogie', 'Backroom Boogie', 'battle', 104, 45, True, 36, 606),
]


def compose(track):
    slug, title, scene, bpm, tonic, minor, bars, seed = track
    rng = np.random.default_rng(seed)
    beat = 60 / bpm
    duration = bars * 4 * beat + 2.5
    mix = np.zeros((int(duration * SR), 2), dtype=np.float32)

    def add(signal, when, gain, pan=0):
        start = max(0, round(when * SR))
        size = min(len(signal), len(mix) - start)
        if size <= 0:
            return
        gains = np.array([math.sqrt((1 - pan) / 2), math.sqrt((1 + pan) / 2)])
        mix[start:start + size] += signal[:size, None] * gains * gain

    def note(midi, length, kind):
        t = np.arange(int(length * SR), dtype=np.float32) / SR
        f = 440 * 2 ** ((midi - 69) / 12)
        phase = 2 * np.pi * f * (t + .00012 * np.sin(2 * np.pi * 4.7 * t))
        if kind == 'bass':
            signal = (np.sin(phase) + .28 * np.sin(2 * phase) * np.exp(-t * 8)
                      + .13 * np.sin(3 * phase) * np.exp(-t * 16)) * np.exp(-t * 3.4)
        elif kind == 'organ':
            signal = sum(a * np.sin(phase * h) for h, a in [(1, .6), (2, .24), (3, .1), (4, .04)])
            signal *= (.92 + .08 * np.sin(2 * np.pi * 5.1 * t))
        else:
            signal = np.zeros(len(t), dtype=np.float32)
            for harmonic in range(1, 9):
                decay = (2.5 if kind == 'piano' else 3.7) + harmonic * .65
                detune = 1 + harmonic * harmonic * (.000055 if kind == 'piano' else .000012)
                weight = (1 / harmonic ** 1.5) * (1 if harmonic % 2 else .72)
                signal += weight * np.sin(phase * harmonic * detune) * np.exp(-decay * t)
            if kind == 'piano':
                signal += .17 * np.sin(phase * 1.0015) * np.exp(-t * 2.5)
            else:
                signal = np.tanh(signal * 1.6) * .7
        envelope = np.minimum(1, t / (.025 if kind == 'organ' else .008))
        envelope *= np.minimum(1, (length - t) / .07)
        return signal * envelope

    def play(midi, at, length, kind, gain, pan=0):
        add(note(midi, length, kind), at + rng.uniform(-.006, .006), gain * rng.uniform(.92, 1.05), pan)

    def drum(kind, at, gain):
        length = {'kick': .3, 'snare': .22, 'hat': .085, 'ride': .32}[kind]
        t = np.arange(int(length * SR), dtype=np.float32) / SR
        noise = rng.normal(size=len(t)).astype(np.float32)
        high = noise - np.convolve(noise, np.ones(7) / 7, mode='same')
        if kind == 'kick':
            signal = np.sin(2 * np.pi * (49 * t + 45 * .024 * (1 - np.exp(-t / .024)))) * np.exp(-t * 17)
            signal += .05 * high * np.exp(-t * 100)
        elif kind == 'snare':
            signal = .35 * high * np.exp(-t * 23) + .22 * np.sin(2 * np.pi * 178 * t) * np.exp(-t * 30)
        elif kind == 'hat':
            signal = .17 * high * np.exp(-t * 65)
        else:
            signal = sum(.04 * np.sin(2 * np.pi * f * t) for f in [3421, 4877, 6211, 7987]) * np.exp(-t * 13)
            signal += .05 * high * np.exp(-t * 20)
        signal *= np.minimum(1, t / .0015)
        add(signal, at, gain, -.25 if kind in ['hat', 'ride'] else .1)

    # Original call-and-response phrases; swung eighths, with room between lines.
    phrases = [
        [(0, 0, .7), (1, 3, .35), (1.67, 4, .45), (2.67, 7, .75)],
        [(0, 10, .5), (.67, 7, .4), (1.67, 4, .6), (3, 0, .6)],
        [(.67, 0, .4), (1, 3, .3), (1.67, 5, .6), (2.67, 6, .3), (3, 7, .7)],
        [(0, 7, .6), (1, 5, .5), (2.67, 3, .6)],
        [(0, 12, .5), (.67, 10, .5), (1.67, 7, .5), (3, 4, .65)],
        [(.67, 3, .3), (1, 4, .5), (2, 0, 1.2)],
        [(0, 0, .5), (1.67, 7, .4), (2, 10, .5), (3, 12, .65)],
        [(0, 7, .5), (.67, 6, .3), (1, 5, .5), (2.67, 0, .8)],
    ]
    for bar in range(bars):
        section = bar // 12
        if minor and scene == 'home':
            root_offset = [0, 0, 5, 5, 0, 0, 8, 7][bar % 8]
        else:
            root_offset = [0, 0, 0, 0, 5, 5, 0, 0, 7, 5, 0, 7][bar % 12]
        root = tonic + root_offset
        start = bar * 4 * beat
        intensity = .78 if bar < 4 else (1 if section != 1 else .88)
        if bar >= bars - 2:
            intensity *= .85
        for pulse in range(4):
            at = start + pulse * beat
            bass_step = [0, 7, (10 if minor else 9), 7][pulse]
            if bar % 4 == 3 and pulse == 3:
                bass_step = -1 if root_offset == 7 else 2
            play(root + bass_step, at, beat * .84, 'bass', .26 * intensity)
            drum('kick', at, (.22 if pulse in [0, 2] else .055) * intensity)
            if pulse in [1, 3]:
                drum('snare', at + .007, .20 * intensity)
            drum('ride' if scene == 'home' else 'hat', at, .25 * intensity)
            drum('hat', at + beat * .66, .18 * intensity)
        chord = [0, 3 if minor else 4, 7, 10]
        for offset in [.67, 2.67]:
            for index, interval in enumerate(chord):
                play(root + 12 + interval, start + offset * beat + index * .009,
                     beat * (1.1 if scene == 'home' else .65), 'piano' if seed % 2 else 'guitar', .065 * intensity, -.34)
        if bar >= 4 and bar % 4 < 2:
            for interval in chord[1:]:
                play(root + 12 + interval, start, beat * 3.3, 'organ', .023, .4)
        if bar >= 2 and bar % 4 != 3:
            phrase = phrases[(bar + seed % 8 + section * 2) % len(phrases)]
            for offset, interval, length in phrase:
                if minor and interval == 4:
                    interval = 3
                if bar < 4 and offset > 2:
                    continue
                play(root + 24 + interval, start + offset * beat, beat * length + .13,
                     'guitar' if seed % 2 else 'piano', .105 * intensity, .22)
        # Sparse fills and turnaround answer phrases avoid a rigid four-bar loop.
        if bar % 12 == 11 and bar < bars - 1:
            for step in range(3):
                drum('snare', start + (3 + step / 3) * beat, .09 + step * .015)
    # Small-room reflections, tape warmth, quiet record noise and tapered edges.
    dry = mix.copy()
    for seconds, gain in [(.074, .12), (.121, .08), (.217, .045)]:
        delay = int(seconds * SR)
        mix[delay:] += dry[:-delay, ::-1] * gain
    mix += rng.normal(0, .00065, mix.shape).astype(np.float32)
    mix = np.tanh(mix * 1.4)
    # A soft 6 kHz roll-off keeps the synthesized band behind the gameplay.
    spectrum = np.fft.rfft(mix, axis=0)
    frequencies = np.fft.rfftfreq(len(mix), 1 / SR)
    spectrum *= (1 / np.sqrt(1 + (frequencies / 5700) ** 6))[:, None]
    mix = np.fft.irfft(spectrum, n=len(mix), axis=0).astype(np.float32)
    fade_in = int(.32 * SR)
    fade_out = int(2.7 * SR)
    mix[:fade_in] *= np.linspace(0, 1, fade_in)[:, None]
    mix[-fade_out:] *= np.linspace(1, 0, fade_out)[:, None]
    mix *= .78 / max(.001, float(np.max(np.abs(mix))))
    pcm = (mix * 32767).astype('<i2').tobytes()
    encoder = lameenc.Encoder()
    encoder.set_bit_rate(128)
    encoder.set_in_sample_rate(SR)
    encoder.set_channels(2)
    encoder.set_quality(2)
    output = DEST / f'{slug}.mp3'
    output.write_bytes(encoder.encode(pcm) + encoder.flush())
    print(f'{title}: {duration:.1f}s, {output.stat().st_size:,} bytes', flush=True)
    return {'id': slug, 'title': title, 'scene': scene, 'bpm': bpm, 'duration': round(duration, 2),
            'src': f'/music/jukebox/{slug}.mp3', 'peak': round(float(np.max(np.abs(mix))), 4),
            'rms': round(float(np.sqrt(np.mean(mix ** 2))), 4)}


if __name__ == '__main__':
    DEST.mkdir(parents=True, exist_ok=True)
    metadata = [compose(track) for track in TRACKS]
    (DEST / 'manifest.json').write_text(json.dumps(metadata, indent=2) + '\n', encoding='utf-8')
