export const THEMES = ['wooden-board', 'crystal', 'retro-arcade', 'sci-fi', 'royal-fanfare', 'soft-minimal', 'felt-piano', 'quiet-pebbles'];
export const EVENTS = ['move', 'capture', 'check', 'checkmate', 'promotion', 'en-passant', 'castling'];

/** Call unlock() directly from your Start button's click handler. */
export class ChessSounds {
  constructor({ baseUrl = './chess-sounds/', theme = 'wooden-board', volume = 0.7 } = {}) {
    if (!THEMES.includes(theme)) throw new Error(`Unknown theme: ${theme}`);
    this.baseUrl = new URL(baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`, document.baseURI);
    this.theme = theme;
    this.volume = Math.min(1, Math.max(0, volume));
    this.cache = new Map();
  }
  async unlock() {
    if (!this.context) {
      this.context = new AudioContext();
      this.gain = this.context.createGain();
      this.gain.gain.value = this.volume;
      this.gain.connect(this.context.destination);
    }
    await this.context.resume();
  }
  setVolume(volume) {
    this.volume = Math.min(1, Math.max(0, volume));
    if (this.gain) this.gain.gain.setTargetAtTime(this.volume, this.context.currentTime, 0.015);
  }
  async load(event, theme = this.theme) {
    if (!EVENTS.includes(event) || !THEMES.includes(theme)) throw new Error('Unknown chess sound');
    if (!this.context) throw new Error('Call unlock() from a user click first');
    const key = `${theme}/${event}.wav`;
    if (!this.cache.has(key)) {
      const request = (async () => {
        const response = await fetch(new URL(key, this.baseUrl));
        if (!response.ok) throw new Error(`Cannot load ${key}: HTTP ${response.status}`);
        return this.context.decodeAudioData(await response.arrayBuffer());
      })();
      this.cache.set(key, request);
      request.catch(() => this.cache.delete(key));
    }
    return this.cache.get(key);
  }
  async setTheme(theme) {
    if (!THEMES.includes(theme)) throw new Error(`Unknown theme: ${theme}`);
    this.theme = theme;
    if (this.context) await this.preload();
  }
  async preload() { await Promise.all(EVENTS.map(event => this.load(event))); }
  async play(event) {
    const buffer = await this.load(event);
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.gain);
    source.start();
    source.onended = () => source.disconnect();
  }
}
