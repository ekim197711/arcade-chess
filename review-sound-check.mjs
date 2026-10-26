import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'file:///C:/Users/mikem/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';

const server = await createServer({
  define: { 'import.meta.env.VITE_SUPABASE_DEV_URL': '""', 'import.meta.env.VITE_SUPABASE_DEV_PUBLISHABLE_KEY': '""' },
  server: { host: '127.0.0.1', port: 0, open: false },
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const requests = [];
  page.on('request', request => { if (request.url().includes('/sound-board-theme/')) requests.push(request.url()); });
  await page.addInitScript(() => {
    localStorage.setItem('arcade-gambit-storage-notice-v1', 'acknowledged');
    localStorage.setItem('neon-knights-sound-v1', 'on');
    localStorage.setItem('neon-knights-music-v1', 'off');
    localStorage.setItem('arcade-chess-sound-theme-v1', 'ceramic-drop');
    localStorage.setItem('arcade-chess-review-preferences-v1', JSON.stringify({ moveSeconds: 0.5, eventMode: 'continue', specialMoveSeconds: 0.5 }));
    localStorage.setItem('arcade-chess-history-v1', JSON.stringify([{
      id: 'review-sound', startedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      bossIndex: 1, opponent: 'Test boss', elo: 150, color: 'w', result: 'unfinished', reason: 'Test',
      pgn: '1. e4 d5 2. exd5 Qxd5 3. Nc3 Qe5+ 4. Be2',
    }]));
    window.soundStarts = 0;
    const original = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource = function () {
      const source = original.call(this), start = source.start.bind(source);
      source.start = (...args) => { window.soundStarts++; return start(...args); };
      return source;
    };
  });
  await page.goto(server.resolvedUrls.local[0] + '#review/review-sound');
  const next = page.getByRole('button', { name: 'Next', exact: true });
  await next.waitFor();
  assert.equal(await page.evaluate(() => window.soundStarts), 0, 'opening review is silent');
  for (let step = 1; step <= 6; step++) {
    await next.click();
    await page.waitForFunction(count => window.soundStarts === count, step);
  }
  for (const event of ['move', 'capture-opponent', 'piece-lost', 'check']) {
    assert(requests.some(url => url.endsWith(`/ceramic-drop/${event}.wav`)), `uses selected theme's ${event} sound`);
  }
  await page.getByRole('button', { name: 'Mute sound effects', exact: true }).click();
  await next.click();
  assert.equal(await page.evaluate(() => window.soundStarts), 6, 'muted navigation is silent');
  await page.getByRole('button', { name: 'Enable sound effects', exact: true }).click();
  assert.equal(await page.evaluate(() => window.soundStarts), 6, 'unmuting alone does not play a move');
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await page.waitForFunction(() => window.soundStarts === 7);
  const best = page.getByRole('button', { name: 'Best move', exact: true });
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent === 'Best move' && !button.disabled));
  await best.click();
  await page.waitForFunction(() => window.soundStarts >= 8);
  await page.getByRole('button', { name: 'Pause line', exact: true }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  const beforeReplay = await page.evaluate(() => window.soundStarts);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.waitForFunction(count => window.soundStarts >= count + 2, beforeReplay);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  assert.deepEqual(errors, []);
  console.log('PASS review move/capture/check sounds, selected theme, mute/unmute, previous, automatic replay, best-move line, no initial or duplicate sounds');
} finally { await browser?.close(); await server.close(); }
