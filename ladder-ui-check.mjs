import assert from 'node:assert/strict';
import { chromium } from 'file:///C:/Users/mikem/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
import { createServer } from 'vite';
import { Chess, freestyleFen } from './src/chess.ts';

const progressKey = 'neon-knights-progress-v1';
const saveKey = 'neon-knights-saved-match-v1';
const server = await createServer({ server: { host: '127.0.0.1', port: 0, open: false } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('neon-knights-sound-v1', 'off');
    localStorage.setItem('neon-knights-music-v1', 'off');
  });
  const url = server.resolvedUrls.local[0];
  await page.goto(url);
  await page.evaluate((key) => localStorage.setItem(key, JSON.stringify({ wins: 5, losses: 2, streak: 0, bestStreak: 3, bossesDefeated: 3, progressionVersion: 2 })), progressKey);
  await page.goto(`${url}#roster`);
  await page.reload();
  const rows = page.locator('.boss-line');
  const select = page.getByLabel('PLAY MODE', { exact: true });
  const read = () => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), progressKey);
  assert.equal(await page.getByRole('heading', { name: 'STANDARD LADDER' }).count(), 1);
  assert.equal(await rows.count(), 59);
  assert.equal(await rows.nth(2).getAttribute('aria-disabled'), 'false');
  assert.equal(await rows.nth(3).getAttribute('aria-disabled'), 'false');
  assert.equal(await rows.nth(4).getAttribute('aria-disabled'), 'true');
  await select.selectOption('freestyle');
  await page.getByRole('heading', { name: 'FREESTYLE LADDER' }).waitFor();
  assert.equal(await rows.nth(0).getAttribute('aria-pressed'), 'true');
  assert.equal(await rows.nth(0).getAttribute('aria-disabled'), 'false');
  assert.equal(await rows.nth(1).getAttribute('aria-disabled'), 'true');
  await page.reload();
  assert.equal(await select.inputValue(), 'freestyle');
  assert.equal(await rows.nth(1).getAttribute('aria-disabled'), 'true');

  // Finish a Freestyle game: only Freestyle's second opponent should unlock.
  const freestyle = new Chess(freestyleFen(518));
  for (const move of ['f3', 'e5', 'g4']) freestyle.move(move);
  await page.evaluate(({ key, pgn }) => localStorage.setItem(key, JSON.stringify({ bossIndex: 0, pgn, tauntIndex: 0, id: 'freestyle-ladder-win' })), { key: saveKey, pgn: freestyle.pgn() });
  await page.goto(`${url}?ladder=freestyle#battle`);
  await page.locator('[data-square="d8"]').click();
  await page.locator('[data-square="h4"]').click();
  await page.waitForURL('**#result/*');
  assert.equal((await read()).freestyleBossesDefeated, 1);
  assert.equal((await read()).bossesDefeated, 3);
  await page.goto(`${url}#roster`);
  assert.equal(await rows.nth(1).getAttribute('aria-disabled'), 'false');
  assert.equal(await rows.nth(2).getAttribute('aria-disabled'), 'true');
  await select.selectOption('standard');
  assert.equal(await rows.nth(3).getAttribute('aria-disabled'), 'false');
  assert.equal(await rows.nth(4).getAttribute('aria-disabled'), 'true');

  // Finish a Standard game from its first rung, checking the reverse isolation.
  await page.evaluate(({ progressKey, saveKey }) => {
    const progress = JSON.parse(localStorage.getItem(progressKey));
    progress.bossesDefeated = 0;
    localStorage.setItem(progressKey, JSON.stringify(progress));
    localStorage.setItem(saveKey, JSON.stringify({ bossIndex: 0, pgn: '1. f3 e5 2. g4', tauntIndex: 0, id: 'standard-ladder-win' }));
  }, { progressKey, saveKey });
  await page.goto(`${url}?ladder=standard#battle`);
  await page.locator('[data-square="d8"]').click();
  await page.locator('[data-square="h4"]').click();
  await page.waitForURL('**#result/*');
  assert.equal((await read()).bossesDefeated, 1);
  assert.equal((await read()).freestyleBossesDefeated, 1);
  await page.goto(`${url}#roster`);
  assert.equal(await rows.nth(1).getAttribute('aria-disabled'), 'false');
  await select.selectOption('freestyle');
  await page.reload();
  assert.equal((await read()).bossesDefeated, 1);
  assert.equal((await read()).freestyleBossesDefeated, 1);
  assert.deepEqual(errors, []);
  console.log('PASS browser independent ladder titles, locks, next selection, remembered mode, v2 migration, Standard/Freestyle wins and persisted isolation');
} finally { await browser?.close(); await server.close(); }
