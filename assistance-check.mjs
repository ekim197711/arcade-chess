import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'file:///C:/Users/mikem/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';

const server = await createServer({ server: { host: '127.0.0.1', port: 0, open: false } });
let browser;
try {
  const { assistanceAssessment, assistanceSample } = await server.ssrLoadModule('/src/reviewAssistance.ts');
  const { normalizeMoveTimes, appendMoveTime, formatMoveTime } = await server.ssrLoadModule('/src/moveTiming.ts');
  const { Chess } = await server.ssrLoadModule('/src/chess.ts');
  const sample = Array.from({ length: 40 }, (_, i) => i);
  const analysis = loss => Object.fromEntries(sample.map(index => [index, { loss: typeof loss === 'function' ? loss(index) : loss, evaluationBefore: 0 }]));
  const timed = sample.map(() => 3000);
  assert.equal(assistanceAssessment(sample, analysis(200), timed, 'server').level, 'very-low');
  assert.equal(assistanceAssessment(sample, analysis(i => i % 4 === 3 ? 100 : 0), timed, 'server').level, 'low');
  assert.equal(assistanceAssessment(sample, analysis(0), timed, 'server').level, 'strong');
  assert.equal(assistanceAssessment(sample, analysis(0), timed, 'device').level, 'elevated');
  assert.equal(assistanceAssessment(sample, analysis(0), undefined, 'server').level, 'elevated', 'missing timing never earns the strongest level');
  assert.equal(assistanceAssessment(sample, analysis(0), timed.map(() => 0), 'server').level, 'elevated', 'premoves do not strengthen suspicion');
  assert.equal(assistanceAssessment(sample, analysis(0), timed.map(() => 180000), 'server').level, 'elevated', 'long interruptions are excluded');
  assert.equal(assistanceAssessment(sample, {}, timed, 'server').level, 'insufficient');
  assert.equal(assistanceAssessment(sample.slice(0, 11), analysis(0), timed, 'server').level, 'insufficient');
  assert.equal(assistanceAssessment(sample, analysis(NaN), timed, 'server').level, 'insufficient');
  assert.deepEqual(normalizeMoveTimes([0, -1, NaN, Infinity, '2000', 2000], 7), [0, null, null, null, null, 2000, null]);
  assert.deepEqual(appendMoveTime([], 3, 1000), [null, null, null, 1000]);
  assert.deepEqual(appendMoveTime([1000], 1, -100), [1000, null]);
  assert.equal(formatMoveTime(null), 'Not recorded');
  assert.equal(formatMoveTime(1234), '1.2s');
  const game = new Chess();
  for (let index = 0; index < 100; index++) game.move(['Nf3', 'Nf6', 'Ng1', 'Ng8'][index % 4]);
  const moves = game.history({ verbose: true });
  assert.equal(assistanceSample(moves, 'w').length, 40);
  assert.ok(assistanceSample(moves, 'w').every(index => index >= 20), 'opening excluded');
  const forced = new Chess('4k3/8/8/8/8/8/8/4K3 w - - 0 1');
  assert.deepEqual(assistanceSample(Array.from({length: 20}, () => ({ color: 'w', before: forced.fen() })), 'w'), [], 'reduced endings excluded');

  await mkdir('.tmp', { recursive: true });
  await writeFile('.tmp/assistance-review.html', `<!doctype html><html><body><div id="root"></div><script type="module">
    import React from 'react'; import { createRoot } from 'react-dom/client';
    import { GameReview } from '/src/GameReview.tsx';
    import '/src/styles.css'; import '/src/light.css'; import '/src/amiga.css';
    createRoot(document.getElementById('root')).render(React.createElement(GameReview, {
      pgn: window.reviewData.pgn, moveTimesMs: window.reviewData.times,
      timingSource: window.reviewData.source, opponentKind: 'human', opponent: 'Opponent', opponentElo: 1200,
      playerName: 'Player', theme: 'medieval', color: 'w', light: '#ddd', dark: '#555', onClose() {}
    }));
  </script></body></html>`);
  await server.listen();
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  for (const level of ['very-low', 'low', 'elevated', 'strong', 'missing', 'failure']) {
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const analyses = Object.fromEntries(moves.map((move, index) => [index, {
      loss: level === 'very-low' ? 200 : level === 'low' && Math.floor(index / 2) % 4 === 3 ? 100 : 0,
      evaluationBefore: 0, evaluationAfter: 0, matches: true, worst: false, suggested: move.san,
      explanation: 'Test position.', playedLine: [move.san], suggestedLine: [move.san],
    }]));
    await page.addInitScript(({ pgn, analyses, level }) => {
      window.reviewData = { pgn, times: level === 'missing' ? undefined : Array.from({length: 100}, () => 3000), source: level === 'elevated' ? 'device' : 'server' };
      const NativeWorker = window.Worker;
      window.Worker = class {
        constructor(url, options) { if (!String(url).includes('review.worker')) return new NativeWorker(url, options); }
        postMessage() {
          queueMicrotask(() => {
            if (level === 'failure') { this.onerror?.(new Event('error')); return; }
            for (const [index, analysis] of Object.entries(analyses)) this.onmessage?.({ data: { index: Number(index), analysis } });
            this.onmessage?.({ data: { done: true } });
          });
        }
        terminate() {}
      };
    }, { pgn: game.pgn(), analyses, level });
    try {
      await page.goto(`${server.resolvedUrls.local[0]}.tmp/assistance-review.html`);
      const player = page.getByRole('article', { name: 'Player assistance assessment', exact: true });
      const expected = level === 'very-low' ? 'Very few assistance indicators' : level === 'low' ? 'Few assistance indicators' : level === 'strong' ? 'Strong assistance indicators' : level === 'failure' ? 'Not enough evidence' : 'Elevated assistance indicators';
      await player.getByText(expected, { exact: true }).waitFor();
      assert.equal(await player.locator('.review-assistance-verdict svg').count(), 1);
      const tone = level === 'very-low' || level === 'low' ? 'green' : level === 'strong' ? 'red' : level === 'failure' ? 'neutral' : 'yellow';
      assert.ok(await player.locator(`.assistance-${tone}`).count());
      if (level === 'missing') await player.getByText('Move timing was not recorded for this game.', { exact: false }).waitFor();
      else {
        const firstMove = page.getByRole('navigation', { name: 'Review move list' }).getByRole('button').first();
        assert.equal(await firstMove.getByLabel('Time spent: 3.0s').innerText(), '3.0s');
        await firstMove.click();
        await page.getByText('Time spent on this move: 3.0s', { exact: true }).waitFor();
      }
      for (const width of [1440, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `layout fits ${width}px`);
      }
      if (level === 'strong') await page.screenshot({ path: '.tmp/assistance-mobile.png', fullPage: true });
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  }
  console.log('PASS four assistance indicator bands, timing influence, missing/invalid/partial data, premove/interruption exclusions, device trust cap, timing badges, colors/icons and mobile layout');
} finally { await browser?.close(); await server.close(); }
