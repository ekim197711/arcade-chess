// A heavy plastic key, a metal latch and the spring settling inside the cabinet.
// Render once per AudioContext; playback has no downloads or decoding delay.
const KEYS = [
  [180, 1320, 0.026, 0.072],
  [215, 1710, 0.033, 0.063],
  [155, 1120, 0.023, 0.085],
  [245, 1980, 0.038, 0.058],
  [195, 1510, 0.029, 0.078],
  [165, 2240, 0.035, 0.069],
] as const;
export const JUKEBOX_CLICK_COUNT = KEYS.length;

export function createJukeboxClickSamples(variant: number, sampleRate: number) {
  const [body, metal, latch, decay] = KEYS[variant];
  const samples = new Float32Array(Math.ceil(sampleRate * 0.19));
  let seed = 937 + variant * 811;
  const noise = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 2147483648 - 1;
  };
  let previous = 0;
  for (let index = 0; index < samples.length; index++) {
    const t = index / sampleRate;
    const n = noise();
    const bright = n - previous * 0.72;
    previous = n;
    const attack = Math.min(1, t / 0.0007);
    const thump = Math.sin(2 * Math.PI * body * t) * Math.exp(-t / 0.011);
    const strike = bright * Math.exp(-t / 0.004);
    const ring = Math.sin(2 * Math.PI * metal * t) * Math.exp(-t / 0.014);
    const s = Math.max(0, t - latch);
    const catchSound = t < latch ? 0 : Math.min(1, s / 0.0005) * (
      bright * 0.42 * Math.exp(-s / 0.003)
      + Math.sin(2 * Math.PI * body * 1.7 * s) * 0.3 * Math.exp(-s / 0.009)
      + Math.sin(2 * Math.PI * metal * 0.63 * s) * 0.08 * Math.exp(-s / (decay * 0.32))
    );
    samples[index] = attack * (thump * 0.43 + strike * 0.24 + ring * 0.1) + catchSound;
  }
  return samples;
}

export function nextJukeboxClick(previous: number, random = Math.random) {
  // Each activation chooses a different key sound, with an even chance per key.
  if (previous < 0) return Math.floor(random() * JUKEBOX_CLICK_COUNT);
  const choice = Math.floor(random() * (JUKEBOX_CLICK_COUNT - 1));
  return choice >= previous ? choice + 1 : choice;
}

const buffers = new WeakMap<AudioContext, AudioBuffer[]>();
let lastClick = -1;
export function playJukeboxClick(context: AudioContext, volume: number) {
  if (volume <= 0) return;
  if (context.state === "suspended") void context.resume().catch(() => {});
  let bank = buffers.get(context);
  if (!bank) {
    bank = KEYS.map((_, variant) => {
      const samples = createJukeboxClickSamples(variant, context.sampleRate);
      const buffer = context.createBuffer(1, samples.length, context.sampleRate);
      buffer.getChannelData(0).set(samples);
      return buffer;
    });
    buffers.set(context, bank);
  }
  lastClick = nextJukeboxClick(lastClick);
  const source = context.createBufferSource();
  const gain = context.createGain();
  source.buffer = bank[lastClick];
  gain.gain.value = Math.max(0, Math.min(1, volume)) * 0.38;
  source.connect(gain);
  gain.connect(context.destination);
  source.onended = () => { source.disconnect(); gain.disconnect(); };
  source.start();
}
