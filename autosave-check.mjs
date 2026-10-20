import assert from 'node:assert/strict';
import { chromium } from 'file:///C:/Users/mikem/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
import { createServer } from 'vite';
import { Chess } from 'chess.js';

const key = 'neon-knights-saved-match-v1';
const server = await createServer({ server: { host: '127.0.0.1', port: 0, open: false } });
let browser;
const chess = (pgn) => { const game = new Chess(); if (pgn) game.loadPgn(pgn); return game; };
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.setDefaultTimeout(15000);
  await page.addInitScript(() => {
    localStorage.setItem('neon-knights-sound-v1', 'off');
    localStorage.setItem('neon-knights-music-v1', 'off');
  });
  const url = server.resolvedUrls.local[0];
  const read = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
  const waitForMoves = async (count) => {
    await page.waitForFunction(key => {
      const saved = JSON.parse(localStorage.getItem(key));
      const history = JSON.parse(localStorage.getItem('arcade-chess-history-v1') ?? '[]');
      // PGN and the archived copy must both reflect the committed position.
      return saved && history.find(match => match.id === saved.id)?.pgn === saved.pgn;
    }, key);
    for (let i = 0; i < 150; i++) {
      const saved = await read();
      if (saved && chess(saved.pgn).history().length >= count) return saved;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`Timed out waiting for ${count} saved moves`);
  };

  await page.goto(url);
  await page.getByRole('button', { name: /^Insert one coin/ }).click();
  await page.getByRole('button', { name: 'Play using one credit' }).click();
  await page.getByRole('button', { name: /^Fight against/ }).click();
  const opening = await waitForMoves(1);
  const move = chess(opening.pgn).moves({ verbose: true }).find(move => move.from === 'e7') ?? chess(opening.pgn).moves({ verbose: true })[0];
  await page.locator(`[data-square="${move.from}"]`).click();
  await page.locator(`[data-square="${move.to}"]`).click();
  const afterPlayer = await waitForMoves(2);
  assert.equal(chess(afterPlayer.pgn).history().length, 2, 'player move saved before bot reply');
  await page.reload();
  const afterBot = await waitForMoves(3);
  assert.equal(afterBot.id, opening.id, 'reload retains match identity');
  assert.equal(afterBot.startedAt, opening.startedAt, 'reload retains start time');
  assert.deepEqual(chess(afterBot.pgn).history().slice(0, 2), chess(afterPlayer.pgn).history());
  await page.evaluate(() => { location.hash = 'roster'; });
  await page.waitForURL('**/#roster');
  await page.reload();
  await page.getByRole('button', { name: /^Resume saved match against/ }).click();
  await page.waitForURL('**/#battle');
  assert.equal((await read()).pgn, afterBot.pgn, 'roster resumes saved position');
  await page.getByRole('button', { name: /TRY AGAIN/ }).click();
  await page.waitForFunction(({key, id}) => JSON.parse(localStorage.getItem(key))?.id !== id, {key, id: opening.id});
  const restarted = await read();
  assert.equal(chess(restarted.pgn).history().length, 0, 'restart replaces old save');
  await page.getByRole('button', { name: /^RESIGN$/ }).click();
  await page.waitForURL('**/#result/*');
  assert.equal(await read(), null, 'resignation clears resumable save');
  await page.evaluate(key => localStorage.setItem(key, '{broken'), key);
  await page.goto(`${url}#roster`);
  await page.reload();
  assert.equal(await page.getByRole('button', { name: /^Resume saved match against/ }).count(), 0);

  // Older manual saves have no start time or match ID. Also exercise a saved
  // opponent above the guest's current unlock so startup cannot reset the game.
  await page.evaluate(key => localStorage.setItem(key, JSON.stringify({ bossIndex: 1, pgn: '1. e4 e5', tauntIndex: 2 })), key);
  await page.reload();
  await page.goto(`${url}#battle`);
  await page.reload();
  const legacy = await waitForMoves(2);
  assert.equal(legacy.bossIndex, 1);
  assert.ok(legacy.id && legacy.startedAt);
  assert.equal(chess(legacy.pgn).fen(), chess('1. e4 e5').fen());
  await page.evaluate(key => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) throw new DOMException('Storage quota reached', 'QuotaExceededError');
      return original.call(this, name, value);
    };
  }, key);
  await page.locator('[data-square="g1"]').click();
  await page.locator('[data-square="f3"]').click();
  await page.getByText('MATCH COULD NOT BE SAVED', { exact: false }).waitFor();
  await page.waitForFunction(id => {
    const match = JSON.parse(localStorage.getItem('arcade-chess-history-v1')).find(match => match.id === id);
    return match?.pgn.includes('Nf3');
  }, legacy.id);
  assert.equal((await read()).pgn, legacy.pgn, 'storage failure leaves the last successful save intact');
  await page.reload(); // Restores normal storage APIs.
  await page.evaluate(key => localStorage.setItem(key, JSON.stringify({ bossIndex: 0, pgn: '1. f3 e5 2. g4', tauntIndex: 0, id: 'mate-test' })), key);
  await page.reload();
  await page.locator('[data-square="d8"]').click();
  await page.locator('[data-square="h4"]').click();
  await page.waitForURL('**/#result/mate-test');
  assert.equal(await read(), null, 'checkmate clears resumable save');
  assert.deepEqual(errors, [], 'no browser runtime errors');
  console.log('PASS automatic player/bot saves, reload during bot turn, identity and history restoration, roster resume, restart, resignation, corrupt and legacy saves, storage failure, checkmate');
} finally {
  await browser?.close();
  await server.close();
}
