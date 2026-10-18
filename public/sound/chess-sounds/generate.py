"""Generate original chess SFX. Requires Python 3 + numpy. No samples used."""
from pathlib import Path
import json, wave, zipfile
import numpy as np

ROOT = Path(__file__).resolve().parent
SR = 44100
RNG = np.random.default_rng(12018)
THEMES = {
    'wooden-board': ('Wooden Board', 'Dry wooden taps and resonant knocks.'),
    'crystal': ('Crystal', 'Bright glass bells and shimmering chimes.'),
    'retro-arcade': ('Retro Arcade', 'Classic pulse-wave bleeps and victory jingles.'),
    'sci-fi': ('Sci-Fi', 'Electronic sweeps, sonar pulses, and power-ups.'),
    'royal-fanfare': ('Royal Fanfare', 'Warm synthesized brass and ceremonial flourishes.'),
    'soft-minimal': ('Soft Minimal', 'Gentle rounded plucks for quiet play.'),
    'felt-piano': ('Felt Piano', 'Muted warm keys with soft attacks and short tails.'),
    'quiet-pebbles': ('Quiet Pebbles', 'Low rounded taps with a gentle, tactile feel.'),
}
EVENTS = ['move', 'capture', 'check', 'checkmate', 'promotion', 'en-passant', 'castling']

def voice(theme, f, length, strength=1):
    t = np.arange(int(SR * length)) / SR
    phase = 2 * np.pi * f * t
    noise = RNG.normal(0, 1, len(t))
    if theme == 'wooden-board':
        y = sum(a*np.sin(phase*r)*np.exp(-t/d) for r,a,d in [(1,1,.055),(1.59,.55,.035),(2.32,.25,.018)])
        y += .23 * noise * np.exp(-t/.006)
    elif theme == 'crystal':
        y = sum(a*np.sin(phase*r)*np.exp(-t/d) for r,a,d in [(1,.75,.23),(2.71,.25,.12),(4.07,.12,.07)])
    elif theme == 'retro-arcade':
        y = sum(np.sin(phase*k)/k for k in range(1,16,2) if f*k < SR*.45)
        y *= .65*np.exp(-t/.17)
    elif theme == 'sci-fi':
        p = 2*np.pi*(f*t + f*.045*(1-np.exp(-t/.045)))
        y = np.sin(p + 2.4*np.sin(phase*1.5)*np.exp(-t/.08))*np.exp(-t/.16)
        y += .14*np.sin(phase/2)*np.exp(-t/.22)
    elif theme == 'royal-fanfare':
        y = sum(np.sin(phase*k + .014*k*np.sin(2*np.pi*5*t)) / k**1.3 for k in range(1,10))
        y *= (1-np.exp(-t/.018))*np.exp(-t/.22)
    elif theme == 'felt-piano':
        y = (np.sin(phase)*np.exp(-t/.13) + .12*np.sin(phase*2)*np.exp(-t/.07)
             + .025*np.sin(phase*3)*np.exp(-t/.035))
        y *= 1-np.exp(-t/.009)
    elif theme == 'quiet-pebbles':
        y = (np.sin(phase)*np.exp(-t/.043) + .18*np.sin(phase*1.48)*np.exp(-t/.025))
        y *= 1-np.exp(-t/.006)
    else:
        y = (np.sin(phase) + .16*np.sin(phase*2))*np.exp(-t/.12)
    fade = np.minimum(t/.003, 1)*np.minimum((length-t)/.045, 1)
    return y * np.clip(fade,0,1) * strength

def effect(theme, event):
    base = {'wooden-board':340,'crystal':880,'retro-arcade':523.25,'sci-fi':440,'royal-fanfare':392,'soft-minimal':523.25,'felt-piano':293.66,'quiet-pebbles':220}[theme]
    # start time, semitone offset, note duration, relative strength
    patterns = {
        'move': [(0,0,.18,.8)],
        'capture': [(0,-12,.23,1),(.045,7,.16,.45)],
        'check': [(0,7,.25,.8),(.17,8,.30,.85)],
        'checkmate': [(0,0,.35,.75),(.16,7,.35,.75),(.32,12,.60,.8),(.32,4,.60,.38),(.32,-12,.60,.5)],
        'promotion': [(0,0,.22,.65),(.09,4,.22,.7),(.18,7,.26,.75),(.29,12,.45,.85),(.34,19,.40,.30)],
        'en-passant': [(0,7,.12,.5),(.07,2,.13,.55),(.15,-8,.24,.95)],
        'castling': [(0,-3,.20,.8),(.16,2,.25,.9)],
    }
    subtle = theme in ('felt-piano', 'quiet-pebbles')
    if subtle:
        # Small consonant intervals; no alarm-like semitones or high flourishes.
        patterns = {
            'move': [(0,0,.19,.8)],
            'capture': [(0,-5,.23,.9),(.045,0,.16,.25)],
            'check': [(0,2,.20,.7),(.16,7,.25,.7)],
            'checkmate': [(0,0,.28,.65),(.18,4,.28,.65),(.36,7,.36,.7),(.36,0,.36,.25)],
            'promotion': [(0,0,.22,.6),(.13,4,.24,.65),(.26,9,.32,.7)],
            'en-passant': [(0,5,.15,.45),(.11,-2,.22,.8)],
            'castling': [(0,0,.18,.7),(.15,5,.22,.75)],
        }
    notes = patterns[event]
    dry = np.zeros(int((max(s+d for s,_,d,_ in notes)+.18)*SR))
    for start, semi, dur, strength in notes:
        v = voice(theme,base*2**(semi/12),dur,strength)
        i = int(start*SR)
        dry[i:i+len(v)] += v
    # Restrained stereo early reflections; dry attack stays centered.
    stereo = np.column_stack((dry,dry))
    wet = {'wooden-board':.025,'crystal':.19,'retro-arcade':.035,'sci-fi':.15,'royal-fanfare':.13,'soft-minimal':.06,'felt-piano':.025,'quiet-pebbles':.008}[theme]
    for channel, delays in enumerate([[.037,.083,.131],[.049,.097,.149]]):
        for j, delay in enumerate(delays):
            shift = int(delay*SR)
            stereo[shift:,channel] += dry[:-shift]*wet/(j+1)
    peak = np.max(np.abs(stereo))
    target = {'move':.46,'capture':.63,'check':.55,'checkmate':.65,'promotion':.58,'en-passant':.58,'castling':.5}[event]
    if subtle:
        target *= .42 if theme == 'felt-piano' else .38
    stereo *= target/peak
    active = np.where(np.max(np.abs(stereo),axis=1) > .0001)[0]
    stereo = stereo[:min(len(stereo),active[-1]+int(SR*.025))]
    stereo[-min(220,len(stereo)):] *= np.linspace(1,0,min(220,len(stereo)))[:,None]
    stereo[0] = 0
    return stereo

def save(path, data):
    with wave.open(str(path),'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(data,-1,1)*32767).astype('<i2').tobytes())

def main():
    manifest = {'format':'WAV PCM 16-bit stereo', 'sampleRate':SR, 'events':EVENTS, 'themes':[]}
    demo=[]
    for key,(name,description) in THEMES.items():
        folder=ROOT/key; folder.mkdir(exist_ok=True)
        entry={'id':key,'name':name,'description':description,'sounds':{}}
        for event in EVENTS:
            data=effect(key,event); save(folder/f'{event}.wav',data)
            entry['sounds'][event]={'file':f'{key}/{event}.wav','duration':round(len(data)/SR,3)}
            demo.extend([data,np.zeros((int(SR*.25),2))])
        demo.append(np.zeros((int(SR*.65),2)))
        manifest['themes'].append(entry)
    save(ROOT/'all-themes-preview.wav',np.concatenate(demo))
    (ROOT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
    print(f'Generated {len(THEMES)*len(EVENTS)} effects in {len(THEMES)} theme folders, plus preview and manifest.')

if __name__ == '__main__': main()
