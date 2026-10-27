import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'file:///C:/Users/mikem/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
import { moveAccuracy, reviewAccuracy } from './src/reviewAccuracy.ts';
import { reviewEngineAgreement } from './src/reviewAssistance.ts';

assert.equal(moveAccuracy(), null);
assert.equal(moveAccuracy({ loss: NaN }), null);
assert.equal(moveAccuracy({ loss: Infinity }), null);
assert.equal(moveAccuracy({ loss: -10 }), 100);
assert.equal(moveAccuracy({ loss: 0 }), 100);
assert.equal(moveAccuracy({ loss: 100 }), 50);
assert.equal(moveAccuracy({ loss: 200 }), 25);
assert.equal(moveAccuracy({ loss: 100_000 }).toFixed(1), '0.0');
const history = [{ color: 'w' }, { color: 'b' }, { color: 'w' }];
assert.deepEqual(reviewAccuracy(history, {}, 'w'), { score: null, analyzed: 0, expected: 2 });
assert.deepEqual(reviewAccuracy(history, { 0: { loss: 0 }, 1: { loss: 200 } }, 'w'), { score: 100, analyzed: 1, expected: 2 });
assert.deepEqual(reviewAccuracy(history, { 0: { loss: 0 }, 2: { loss: 100 } }, 'w'), { score: 75, analyzed: 2, expected: 2 });
assert.deepEqual(reviewAccuracy(history, { 1: { loss: 200 } }, 'b'), { score: 25, analyzed: 1, expected: 1 });
assert.deepEqual(reviewAccuracy([], {}, 'w'), { score: null, analyzed: 0, expected: 0 });
assert.deepEqual(reviewEngineAgreement(history, {}, 'w'), { agreement: null, analyzed: 0, expected: 2, matches: 0, longestStreak: 0 });
assert.deepEqual(reviewEngineAgreement(history, { 0: { loss: 0 }, 1: { loss: 100 }, 2: { loss: 0 } }, 'w'), { agreement: 100, analyzed: 2, expected: 2, matches: 2, longestStreak: 2 });
assert.equal(reviewEngineAgreement(history, { 0: { loss: 0 }, 2: { loss: 100 } }, 'w').agreement, 50);
const runMoves = Array.from({ length: 5 }, () => ({ color: 'b' }));
assert.equal(reviewEngineAgreement(runMoves, { 0: { loss: 0 }, 1: { loss: 0 }, 3: { loss: 0 }, 4: { loss: 0 } }, 'b').longestStreak, 2);
assert.equal(reviewEngineAgreement(runMoves, { 0: { loss: NaN }, 1: { loss: -1 }, 2: { loss: Infinity } }, 'b').analyzed, 0);

const server = await createServer({ server: { host: '127.0.0.1', port: 0, open: false } });
let browser;
try {
  const { Chess } = await server.ssrLoadModule('/src/chess.ts');
  const { analyzeMove } = await server.ssrLoadModule('/src/bot.ts');
  const game = new Chess();
  game.loadPgn('1. f3 e5 2. g4 Qh4#');
  const moves = game.history({ verbose: true });
  const analyses = Object.fromEntries(moves.map((move, index) => [index, analyzeMove(move.before, move.san)]));
  await server.listen();
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(({ pgn }) => {
    localStorage.setItem('neon-knights-sound-v1', 'off');
    localStorage.setItem('neon-knights-music-v1', 'off');
    localStorage.setItem('arcade-chess-history-v1', JSON.stringify([{
      id: 'accuracy-test', startedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      bossIndex: 0, opponent: 'Test opponent', elo: 100, color: 'b', pgn, result: 'win', reason: 'Checkmate',
    }]));
  }, { pgn: game.pgn() });
  await page.goto(`${server.resolvedUrls.local[0]}#review/accuracy-test`);
  await page.getByText('Analyzed 4 of 4 moves', { exact: true }).waitFor();
  const summary = page.getByRole('region', { name: 'Game accuracy', exact: true });
  const scores = await summary.locator('.review-accuracy-scores strong').allTextContents();
  assert.deepEqual(scores, ['b', 'w'].map(side => `${reviewAccuracy(moves, analyses, side).score.toFixed(1)}%`));
  const assistance = page.getByRole('region', { name: 'Assistance assessment', exact: true });
  assert.match(await assistance.getByRole('article', { name: 'Player assistance assessment', exact: true }).innerText(), /Assistance likelihood: undetermined/);
  assert.match(await assistance.getByRole('article', { name: 'Bot assistance assessment', exact: true }).innerText(), /Known automated opponent/);
  for (const [index, side] of ['b', 'w'].entries()) {
    const expected = reviewEngineAgreement(moves, analyses, side);
    assert.deepEqual(await assistance.locator('article').nth(index).locator('dd').allTextContents(), [
      `${expected.agreement.toFixed(1)}%`, `${expected.matches} / ${expected.analyzed}`, `${expected.longestStreak} moves`,
    ]);
  }
  const buttons = page.getByRole('navigation', { name: 'Review move list' }).getByRole('button');
  for (let index = 0; index < moves.length; index++) {
    const expected = `${moveAccuracy(analyses[index]).toFixed(1)}%`;
    assert.equal(await buttons.nth(index).locator('.review-move-accuracy').innerText(), expected);
    await buttons.nth(index).click();
    assert.equal(await page.locator('.review-selected-accuracy .review-move-accuracy').innerText(), expected);
  }
  for (const width of [1440, 900, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    assert.ok(await buttons.evaluateAll(items => items.every(item => item.scrollWidth <= item.clientWidth)));
  }
  // Worker failures must leave scores unavailable, rather than displaying zero.
  await page.route('**/review.worker.ts*', route => route.abort());
  await page.reload();
  await page.getByText('Analysis unavailable. Replay is still available.', { exact: true }).waitFor();
  assert.deepEqual(await summary.locator('.review-accuracy-scores strong').allTextContents(), ['—', '—']);
  assert.equal(await buttons.first().getByLabel('Accuracy unavailable').innerText(), '—');
  assert.match(await assistance.innerText(), /Partial analysis/);
  assert.equal(await assistance.locator('dd').first().innerText(), '—');
  assert.deepEqual(errors, []);
  console.log('PASS accuracy and assistance: loss scale, side averages, agreement and runs, partial/empty data, player/bot context, all moves, selection, worker failure, desktop/mobile layout');
} finally {
  await browser?.close();
  await server.close();
}
