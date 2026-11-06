import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { chromium } from 'file:///C:/Users/mikem/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
import { createServer } from 'vite';
const themes = readdirSync('public/sound-board-theme', { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => ({ ...JSON.parse(readFileSync(`public/sound-board-theme/${entry.name}/manifest.json`, 'utf8')), folder: entry.name }));
const server = await createServer({ server: { host: '127.0.0.1', port: 0, open: false } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('neon-knights-sound-v1', 'on');
    localStorage.setItem('neon-knights-music-v1', 'off');
    globalThis.soundStarts = [];
    const original = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource = function () {
      const source = original.call(this), start = source.start.bind(source);
      source.start = (when = this.currentTime, ...args) => {
        let peak = 0;
        for (let channel = 0; channel < source.buffer.numberOfChannels; channel++) {
          for (const sample of source.buffer.getChannelData(channel)) peak = Math.max(peak, Math.abs(sample));
        }
        globalThis.soundStarts.push({ when, duration: source.buffer.duration, peak });
        return start(when, ...args);
      };
      return source;
    };
  });
  const url = server.resolvedUrls.local[0];
  await page.goto(`${url}#settings`);
  assert.equal(await page.getByLabel('Sound effects volume', { exact: true }).inputValue(), '85');
  assert.equal(await page.locator('.sound-theme-option').count(), themes.length);
  for (const theme of themes) {
    const response = page.waitForResponse(response => response.url().endsWith(`/sound-board-theme/${theme.folder}/preview.wav`));
    await page.getByRole('button', { name: `Use ${theme.name} sound theme`, exact: true }).click();
    assert((await response).ok());
    await page.waitForFunction(id => localStorage.getItem('arcade-chess-sound-theme-v1') === id, theme.id);
  }
  await page.waitForFunction(count => globalThis.soundStarts.length >= count, themes.length);
  const previewPeaks = await page.evaluate(() => globalThis.soundStarts.map(sound => sound.peak));
  assert(previewPeaks.every(peak => peak > .2 && peak <= .751), 'theme previews should be audible with headroom');
  // Decode every supplied file in the browser's real Web Audio implementation.
  await page.evaluate(async themes => {
    const context = new AudioContext();
    try {
      for (const theme of themes) for (const file of [...Object.values(theme.events).map(event => event.file), 'preview.wav']) {
        const response = await fetch(`/sound-board-theme/${theme.folder}/${file}`);
        if (!response.ok) throw new Error(`Missing sound: ${theme.folder}/${file}`);
        const buffer = await context.decodeAudioData(await response.arrayBuffer());
        if (!buffer.length) throw new Error(`Empty sound: ${theme.folder}/${file}`);
      }
    } finally { await context.close(); }
  }, themes);
  const chosen = themes.find(theme => theme.id === 'ceramic-drop');
  await page.getByRole('button', { name: `Use ${chosen.name} sound theme`, exact: true }).click();
  await page.reload();
  assert.equal(await page.getByRole('button', { name: `Use ${chosen.name} sound theme`, exact: true }).getAttribute('aria-pressed'), 'true');
  await page.evaluate(() => localStorage.setItem('neon-knights-saved-match-v1', JSON.stringify({ id: 'sound-win', bossIndex: 0, pgn: '1. f3 e5 2. g4', tauntIndex: 0 })));
  await page.goto(`${url}?sound-test#battle`);
  assert.equal(await page.locator('.sound-theme-option').count(), themes.length);
  for (const theme of themes) assert.equal(await page.getByRole('button', { name: `Use ${theme.name} sound theme`, exact: true }).count(), 1);
  await page.locator('[data-square="d8"]').click();
  await page.evaluate(() => { globalThis.soundStarts = []; });
  const mate = page.waitForResponse(response => response.url().endsWith('/ceramic-drop/checkmate.wav'));
  const win = page.waitForResponse(response => response.url().endsWith('/ceramic-drop/win.wav'));
  await page.locator('[data-square="h4"]').click();
  assert((await mate).ok()); assert((await win).ok());
  await page.waitForFunction(() => globalThis.soundStarts.filter(cue => cue.duration > .14).length >= 2);
  const cues = await page.evaluate(() => globalThis.soundStarts.filter(cue => cue.duration > .14));
  assert(cues.every(cue => cue.peak > .2 && cue.peak <= .751), 'board and result cues should use boosted audio');
  assert(cues[1].when >= cues[0].when + cues[0].duration, 'result cue must follow the board cue');
  await page.evaluate(() => localStorage.setItem('neon-knights-saved-match-v1', JSON.stringify({ id: 'sound-loss', bossIndex: 0, pgn: '1. e4', tauntIndex: 0 })));
  await page.goto(`${url}?sound-loss#battle`);
  const lose = page.waitForResponse(response => response.url().endsWith('/ceramic-drop/lose.wav'));
  await page.getByRole('button', { name: 'RESIGN', exact: true }).click();
  assert((await lose).ok());
  assert.deepEqual(errors, []);
  console.log('PASS both theme menus, all previews, 130 browser audio decodes, persisted new theme, correct checkmate/win sequencing and resignation loss cue');
} finally { await browser?.close(); await server.close(); }
