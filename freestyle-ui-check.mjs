import assert from 'node:assert/strict';
import { chromium } from 'file:///C:/Users/mikem/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
import { createServer } from 'vite';
import { Chess } from './src/chess.ts';

const key = 'neon-knights-saved-match-v1';
const server = await createServer({ server: { host: '127.0.0.1', port: 0, open: false } });
let browser;
const restore = (pgn) => { const game = new Chess(); game.loadPgn(pgn); return game; };
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
  const read = () => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), key);
  async function waitMoves(count) {
    await page.waitForFunction(({ key, count }) => {
      const saved = JSON.parse(localStorage.getItem(key));
      const record = JSON.parse(localStorage.getItem('arcade-chess-history-v1') ?? '[]').find((match) => match.id === saved?.id);
      return saved && record?.pgn === saved.pgn && (saved.pgn.split('\n\n')[1]?.match(/\b[a-hNBRQKO][^\s]*/g)?.length ?? 0) >= count;
    }, { key, count });
    return read();
  }
  await page.goto(url);
  await page.getByRole('button', { name: /^Insert one coin/ }).click();
  await page.getByRole('button', { name: 'Standard', exact: true }).click();
  await page.getByLabel('PLAY MODE', { exact: true }).selectOption('freestyle');
  await page.getByRole('button', { name: /^Fight against/ }).click();
  await page.getByText('FREESTYLE · CHESS960', { exact: false }).waitFor();
  const opening = await waitMoves(1);
  assert.equal(restore(opening.pgn).mode, 'freestyle');
  const move = restore(opening.pgn).moves({ verbose: true }).find((move) => move.from === 'e7');
  await page.locator(`[data-square="${move.from}"]`).click();
  await page.locator(`[data-square="${move.to}"]`).click();
  const after = await waitMoves(3);
  await page.reload();
  assert.equal((await read()).pgn, after.pgn);
  await page.goto(`${url}#roster`);
  assert.equal(await page.getByLabel('PLAY MODE', { exact: true }).inputValue(), 'freestyle');
  await page.getByRole('button', { name: /^Resume saved match against/ }).click();
  await page.getByText('FREESTYLE · CHESS960', { exact: false }).waitFor();
  assert.equal((await read()).pgn, after.pgn);

  // Changing mode must start a new game instead of resuming the other variant.
  await page.goto(`${url}#roster`);
  await page.getByLabel('PLAY MODE', { exact: true }).selectOption('standard');
  await page.getByRole('button', { name: /^Fight against/ }).click();
  await page.waitForFunction(({ key, id }) => JSON.parse(localStorage.getItem(key))?.id !== id, { key, id: opening.id });
  assert.equal(restore((await read()).pgn).mode, 'standard');

  // Seed a legal middlegame to exercise king-to-rook castling through the UI.
  const castle = new Chess('4k2r/8/8/8/8/8/PPPPPPPP/4K3 b h - 0 1 chess960');
  await page.evaluate(({ key, pgn }) => {
    localStorage.setItem(key, JSON.stringify({ bossIndex: 0, pgn, tauntIndex: 0, id: 'castle-ui' }));
  }, { key, pgn: castle.pgn() });
  await page.reload();
  await page.locator('[data-square="e8"]').click();
  await page.locator('[data-square="h8"]').click();
  await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key)).pgn.includes('O-O'), key);
  const castled = restore((await read()).pgn);
  assert.equal(castled.get('g8').type, 'k');
  assert.equal(castled.get('f8').type, 'r');
  await page.getByRole('button', { name: /^RESIGN$/ }).click();
  await page.waitForURL('**/#result/*');
  await page.getByRole('button', { name: 'Analyze & replay' }).click();
  await page.waitForURL('**/#review/*');
  await page.waitForFunction(() => [...document.querySelectorAll('[role="status"]')].some((element) => /Analyzed [1-9]\d* of \d+ moves/.test(element.textContent)));
  await page.getByRole('button', { name: 'End', exact: true }).click();
  await page.getByLabel('g8 Black k', { exact: true }).waitFor();
  await page.getByLabel('f8 Black r', { exact: true }).waitFor();
  assert.deepEqual(errors, []);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${url}#roster`);
  const selector = await page.getByLabel('PLAY MODE', { exact: true }).boundingBox();
  assert(selector && selector.x >= 0 && selector.x + selector.width <= 390);
  console.log('PASS browser mode selection, moves, bot, reload, resume, mode switch, castling, review, mobile selector, no page errors');
} finally {
  await browser?.close();
  await server.close();
}
