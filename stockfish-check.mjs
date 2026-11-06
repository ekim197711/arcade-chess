import assert from 'node:assert/strict';
import { createServer, preview } from 'vite';
import { chromium } from 'file:///C:/Users/mikem/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';

const production = process.argv.includes('--production');
const server = production
  ? await preview({ preview: { host: '127.0.0.1', port: 0, open: false } })
  : await createServer({ server: { host: '127.0.0.1', port: 0, open: false } });
let browser;
try {
  if (!production) await server.listen();
  const url = server.resolvedUrls.local[0];
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('neon-knights-sound-v1', 'off');
    localStorage.setItem('neon-knights-music-v1', 'off');
    const OriginalWorker = Worker;
    globalThis.engineRuns = [];
    globalThis.Worker = class extends OriginalWorker {
      constructor(url, options) {
        super(url, options);
        if (String(url).includes('/stockfish/')) {
          const run = { commands: [], lines: [], terminated: false };
          globalThis.engineRuns.push(run);
          this.addEventListener('message', event => run.lines.push(String(event.data)));
          const send = this.postMessage.bind(this), terminate = this.terminate.bind(this);
          this.postMessage = command => { run.commands.push(command); send(command); };
          this.terminate = () => { run.terminated = true; terminate(); };
        }
      }
    };
  });
  await page.goto(url);
  const wasm = await page.request.get(`${url}stockfish/stockfish-19-lite-single.wasm`);
  assert.equal(wasm.status(), 200);
  assert.match(wasm.headers()['content-type'], /application\/wasm/);
  const license = await page.request.get(`${url}stockfish/Copying.txt`);
  assert.match(await license.text(), /GNU GENERAL PUBLIC LICENSE/);

  if (!production) {
    const result = await page.evaluate(async () => {
      const { requestStockfishMove, stockfishStrength, stockfishPosition, beginnerMove } = await import('/src/stockfish.ts');
      const { Chess, freestyleFen } = await import('/src/chess.ts');
      const ratings = Array.from({ length: 59 }, (_, index) => 100 + index * 50);
      const configurations = ratings.map(elo => stockfishStrength(elo));
      // Use real Stockfish for beginner, boundary, intermediate, and top ratings.
      for (const elo of [100, 1300, 1350, 2000, 3000]) {
        const game = new Chess();
        const move = await requestStockfishMove(game.fen(), game.pgn(), elo, new AbortController().signal);
        if (!move || !game.move(move)) throw new Error(`Illegal Stockfish move at ${elo}`);
      }
      for (const pgn of ['1. e4', '1. f3 e5 2. g4', '1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. O-O']) {
        const game = new Chess(); game.loadPgn(pgn);
        const move = await requestStockfishMove(game.fen(), game.pgn(), 2000, new AbortController().signal);
        if (!move || !game.move(move)) throw new Error('Illegal move after historic position');
      }
      const freestyle = new Chess(freestyleFen(518));
      const freestyleMove = await requestStockfishMove(freestyle.fen(), freestyle.pgn(), 2000, new AbortController().signal);
      if (!freestyleMove || !freestyle.move(freestyleMove)) throw new Error('Illegal Chess960 move');
      const promotion = new Chess('7k/P7/8/8/8/8/8/7K w - - 0 1');
      const promoted = await requestStockfishMove(promotion.fen(), promotion.pgn(), 3000, new AbortController().signal);
      if (!promoted || !promotion.move(promoted)) throw new Error('Illegal promotion');
      const repetition = new Chess(); repetition.loadPgn('1. Nf3 Nf6 2. Ng1 Ng8');
      const historyCommand = stockfishPosition(repetition.pgn(), repetition.fen());
      const controller = new AbortController();
      const cancelled = requestStockfishMove(new Chess().fen(), '', 3000, controller.signal).catch(error => error.name);
      controller.abort();
      const cancelledName = await cancelled;
      const candidates = new Map([['e2e4', 40], ['a2a3', -300]]);
      const weak = beginnerMove('e2e4', candidates, 100, 1320, () => .9);
      const strong = beginnerMove('e2e4', candidates, 1320, 1320, () => .9);
      // Verify the UCI protocol for every rung independently of search speed.
      const ActualWorker = globalThis.Worker;
      const protocolRuns = [];
      globalThis.Worker = class {
        constructor() { this.commands = []; protocolRuns.push(this.commands); }
        postMessage(command) {
          this.commands.push(command);
          if (command === 'uci') queueMicrotask(() => {
            for (const data of ['option name UCI_LimitStrength type check default false', 'option name UCI_Elo type spin default 1320 min 1320 max 3190', 'uciok']) this.onmessage?.({ data });
          });
          if (command === 'isready') queueMicrotask(() => this.onmessage?.({ data: 'readyok' }));
          if (command.startsWith('go ')) queueMicrotask(() => this.onmessage?.({ data: 'bestmove e2e4' }));
        }
        terminate() {}
      };
      try {
        for (const elo of ratings) await requestStockfishMove(new Chess().fen(), '', elo, new AbortController().signal);
      } finally { globalThis.Worker = ActualWorker; }
      return { configurations, historyCommand, cancelledName, weak, strong, protocolRuns };
    });
    assert.equal(result.configurations.length, 59);
    result.configurations.forEach((strength, index) => {
      const elo = 100 + index * 50;
      assert.equal(strength.requestedElo, elo);
      assert.equal(strength.engineElo, Math.max(1320, elo));
      assert.equal(strength.beginner, elo < 1320);
    });
    assert.match(result.historyCommand, /moves g1f3 g8f6 f3g1 f6g8$/);
    assert.equal(result.cancelledName, 'AbortError');
    assert.equal(result.weak, 'a2a3');
    assert.equal(result.strong, 'e2e4');
    result.protocolRuns.forEach((commands, index) => {
      assert(commands.includes('setoption name UCI_LimitStrength value true'));
      assert(commands.includes(`setoption name UCI_Elo value ${Math.max(1320, 100 + index * 50)}`));
      assert(commands.indexOf('isready') < commands.findIndex(command => command.startsWith('go ')));
    });
    const runs = await page.evaluate(() => globalThis.engineRuns);
    for (const [index, elo] of [100, 1300, 1350, 2000, 3000].entries()) {
      const run = runs[index];
      assert(run.commands.includes('setoption name UCI_LimitStrength value true'));
      assert(run.commands.includes(`setoption name UCI_Elo value ${Math.max(1320, elo)}`));
      assert(run.commands.indexOf('isready') < run.commands.findIndex(command => command.startsWith('go ')));
      assert(run.lines.some(line => line.startsWith('bestmove ')));
      assert(run.terminated);
    }
    assert(runs.some(run => run.commands.includes('setoption name UCI_Chess960 value true')));
  }

  // Exercise the actual battle UI, including consecutive turns at the same boss rating.
  await page.evaluate(() => localStorage.setItem('neon-knights-saved-match-v1', JSON.stringify({ id: 'stockfish-battle', bossIndex: 58, pgn: '', tauntIndex: 0 })));
  await page.goto(`${url}?engine-check#battle`);
  await page.waitForFunction(() => {
    const saved = JSON.parse(localStorage.getItem('neon-knights-saved-match-v1'));
    return saved?.pgn.includes('1.');
  }, null, { timeout: 30000 });
  const firstRun = await page.evaluate(() => globalThis.engineRuns[0]);
  assert(firstRun.commands.includes('setoption name UCI_Elo value 3000'));
  assert(firstRun.commands.includes('setoption name UCI_LimitStrength value true'));
  assert.equal(await page.getByRole('button', { name: 'Retry engine' }).count(), 0);
  const beforeFailure = await page.evaluate(() => localStorage.getItem('neon-knights-saved-match-v1'));
  // Loading failures must offer retry without silently playing random moves.
  await page.route('**/stockfish/stockfish-19-lite-single.js', route => route.abort());
  await page.evaluate(() => localStorage.setItem('neon-knights-saved-match-v1', JSON.stringify({ id: 'stockfish-failure', bossIndex: 58, pgn: '', tauntIndex: 0 })));
  await page.goto(`${url}?engine-failure#battle`);
  await page.getByRole('button', { name: 'Retry engine' }).waitFor({ timeout: 30000 });
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('neon-knights-saved-match-v1')).pgn), '');
  await page.unroute('**/stockfish/stockfish-19-lite-single.js');
  await page.getByRole('button', { name: 'Retry engine' }).click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('neon-knights-saved-match-v1')).pgn.includes('1.'), null, { timeout: 30000 });
  assert(beforeFailure);
  assert.deepEqual(errors, []);
  console.log(`PASS ${production ? 'production assets and battle' : '59 boss strength settings, real WASM moves, history, Chess960, promotion, cancellation and battle'}, exact UCI Elo commands, visible error/retry without random fallback`);
} finally {
  await browser?.close();
  if (production) await new Promise(resolve => server.httpServer.close(resolve));
  else await server.close();
}
