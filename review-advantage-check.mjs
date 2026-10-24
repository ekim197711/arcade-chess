import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'file:///C:/Users/mikem/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';

const server = await createServer({ server: { host: '127.0.0.1', port: 0, open: false } });
let browser;
try {
  const { Chess } = await server.ssrLoadModule('/src/chess.ts');
  const { analyzeMove } = await server.ssrLoadModule('/src/bot.ts');
  const { reviewAdvantage, reviewEvaluationChange } = await server.ssrLoadModule('/src/reviewAdvantage.ts');
  assert.equal(reviewEvaluationChange(125, 50), '+0.75');
  assert.equal(reviewEvaluationChange(-125, 50), '-1.75');
  assert.equal(reviewEvaluationChange(50, 50), '0.00');
  assert.equal(reviewEvaluationChange(undefined, 50), null);
  assert.equal(reviewEvaluationChange(100_000, 50), null);
  assert.equal(reviewEvaluationChange(50, -100_000), null);
  const game = new Chess();
  game.loadPgn('1. f3 e5 2. g4 Qh4#');
  const moves = game.history({ verbose: true });
  for (const move of moves) {
    const result = analyzeMove(move.before, move.san);
    const sign = move.color === 'w' ? 1 : -1;
    assert.equal(sign * (result.evaluationBefore - result.evaluationAfter) || 0, result.loss);
  }
  const mistake = analyzeMove(moves[2].before, 'g4');
  assert.equal(mistake.evaluationAfter, -100_000);
  assert.equal(reviewAdvantage(new Chess(moves[2].after), mistake.evaluationAfter, false).label, 'Black has a forced mate');
  assert.equal(reviewAdvantage(game, undefined, false).label, 'Black wins by checkmate');
  assert.equal(reviewAdvantage(game, undefined, false).whitePercent, 0);
  const whiteMate = new Chess();
  whiteMate.loadPgn('1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7#');
  assert.equal(reviewAdvantage(whiteMate, undefined, false).whitePercent, 100);
  const repetition = new Chess();
  repetition.loadPgn('1. Nf3 Nf6 2. Ng1 Ng8 3. Nf3 Nf6 4. Ng1 Ng8');
  assert.equal(reviewAdvantage(repetition, 500, false).label, 'Drawn position');
  assert.equal(reviewAdvantage(new Chess(), undefined, false).pending, true);
  assert.equal(reviewAdvantage(new Chess(), undefined, true).label, 'Evaluation unavailable');
  assert.equal(reviewAdvantage(new Chess(), 25, false).label, 'About equal');
  for (const score of [-900, 900]) {
    const result = reviewAdvantage(new Chess(), score, false);
    assert.equal(result.label, `${score > 0 ? 'White' : 'Black'} is ahead`);
    assert.equal(result.whitePercent > 50, score > 0);
  }

  await server.listen();
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(({ pgn }) => {
    localStorage.setItem('neon-knights-sound-v1', 'off');
    localStorage.setItem('neon-knights-music-v1', 'off');
    localStorage.setItem('arcade-chess-history-v1', JSON.stringify([{
      id: 'advantage-test', startedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      bossIndex: 0, opponent: 'Test opponent', elo: 100, color: 'b', pgn, result: 'win', reason: 'Checkmate',
    }]));
  }, { pgn: game.pgn() });
  await page.goto(`${server.resolvedUrls.local[0]}#review/advantage-test`);
  const advantage = page.getByRole('region', { name: 'Position evaluation' });
  await advantage.waitFor();
  await page.getByText('Analyzed 4 of 4 moves', { exact: true }).waitFor();
  assert.match(await advantage.innerText(), /Change from previous: —/);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  const first = await advantage.innerText();
  const firstAnalysis = analyzeMove(moves[0].before, moves[0].san);
  assert.equal(await advantage.locator('.review-advantage-change strong').innerText(), reviewEvaluationChange(firstAnalysis.evaluationAfter, firstAnalysis.evaluationBefore));
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  const secondAnalysis = analyzeMove(moves[1].before, moves[1].san);
  assert.equal(await advantage.locator('.review-advantage-change strong').innerText(), reviewEvaluationChange(secondAnalysis.evaluationAfter, firstAnalysis.evaluationAfter));
  await page.getByRole('button', { name: /2\. g4/ }).click();
  assert.match(await advantage.innerText(), /Black has a forced mate/);
  await page.getByRole('button', { name: 'End', exact: true }).click();
  assert.match(await advantage.innerText(), /Black wins by checkmate/);
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  assert.match(await advantage.innerText(), /Black has a forced mate/);
  await page.getByLabel('Replay position').fill('1');
  assert.equal(await advantage.innerText(), first);
  await page.getByRole('button', { name: 'Best move', exact: true }).click();
  assert.equal(await advantage.count(), 0);
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await advantage.waitFor();
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const box = await advantage.boundingBox();
    assert.ok(box.width > 0 && box.x >= 0 && box.x + box.width <= width);
  }
  assert.deepEqual(errors, []);
  console.log('PASS review advantage: score direction, historic navigation, both checkmates, repetition draw, pending/failure, variations, responsive layout');
} finally {
  await browser?.close();
  await server.close();
}
