import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'file:///C:/Users/mikem/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
const server = await createServer({ server: { host: '127.0.0.1', port: 0, open: false, watch: null } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('neon-knights-music-v1', 'off');
    localStorage.setItem('neon-knights-sound-v1', 'off');
    localStorage.setItem('arcade-gambit-storage-notice-v1', 'acknowledged');
    localStorage.setItem('arcade-gambit-analytics-consent-v1', 'denied');
  });
  await page.goto(server.resolvedUrls.local[0]);
  await page.getByRole('button', { name: 'Game history', exact: true }).waitFor();
  assert.equal(await page.locator('.history-page').count(), 0);
  await page.getByRole('button', { name: 'Game history', exact: true }).click();
  await page.getByRole('heading', { name: 'Your games', exact: true }).waitFor();
  assert.equal(await page.locator('.classic-game-card').count(), 3);
  const search = page.getByRole('searchbox', { name: 'Search historic battles' });
  for (const term of ['Morphy', '1858', 'Philidor']) {
    await search.fill(term);
    assert.equal(await page.locator('.classic-game-card').count(), 1);
    assert.match(await page.locator('.classic-game-card').textContent(), /Opera Game/);
  }
  await search.fill('no-such-player');
  assert.equal(await page.locator('.classic-game-card').count(), 0);
  await search.fill('');
  const games = await page.evaluate(async () => {
    const { CLASSIC_GAMES, classicPgn } = await import('/src/classicGames.ts');
    const { Chess } = await import('/src/chess.ts');
    return CLASSIC_GAMES.map(game => {
      const board = new Chess(); board.loadPgn(classicPgn(game));
      return { id: game.id, mate: board.isCheckmate(), plies: board.history().length };
    });
  });
  for (const game of games) {
    assert(game.mate, `${game.id} must end in checkmate`);
    await page.goto(`${server.resolvedUrls.local[0]}#history/classic/${game.id}`);
    await page.getByRole('button', { name: 'Back to game history', exact: true }).waitFor();
    assert.equal(await page.locator('.game-review').count(), 1);
    await page.reload();
    await page.getByRole('button', { name: 'Back to game history', exact: true }).click();
    await search.waitFor();
  }
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `page fits ${width}px`);
  }
  await page.getByRole('button', { name: 'Back to arcade', exact: true }).click();
  await page.getByRole('button', { name: 'Game history', exact: true }).waitFor();
  assert.equal(await page.locator('.history-page').count(), 0);
  assert.deepEqual(errors, []);
  console.log('PASS history navigation, historic search, legal classic scores, replay deep links, reload, return home and mobile layout');
} finally { await browser?.close(); await server.close(); }
