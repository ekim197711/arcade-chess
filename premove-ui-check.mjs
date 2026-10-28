import assert from 'node:assert/strict';
import { chromium } from 'file:///C:/Users/mikem/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
import { createServer } from 'vite';
import { Chess as StandardChess } from 'chess.js';

const userId = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';
const user = { id: userId, aud: 'authenticated', role: 'authenticated', email: 'premove@example.com', app_metadata: {}, user_metadata: { full_name: 'Premove player' }, created_at: '2026-01-01T00:00:00Z' };
const server = await createServer({ define: {
  'import.meta.env.VITE_SUPABASE_DEV_URL': JSON.stringify('https://premove-check.supabase.co'),
  'import.meta.env.VITE_SUPABASE_DEV_PUBLISHABLE_KEY': JSON.stringify('sb_publishable_test'),
}, server: { host: '127.0.0.1', port: 0, open: false } });
let browser;
try {
  const { premoveBoard } = await server.ssrLoadModule('/src/premoves.ts');
  const { Chess } = await server.ssrLoadModule('/src/chess.ts');
  const game = new Chess();
  const chain = Array.from({ length: 200 }, (_, i) => ({ from: i % 2 ? 'f3' : 'g1', to: i % 2 ? 'g1' : 'f3' }));
  assert.equal(premoveBoard(game, chain, 'w').get('g1').type, 'n');
  assert.equal(game.history().length, 0, 'preview never mutates the real position');
  const freed = premoveBoard(game, [{ from: 'e2', to: 'e4' }, { from: 'f1', to: 'c4' }], 'w');
  assert.equal(freed.get('c4').type, 'b');
  assert.ok(premoveBoard(game, [], 'w').targets('e2').includes('d3'), 'allow a capture that may become possible');
  for (const variant of ['', ' chess960']) {
    const castle = new Chess('4k3/8/8/8/8/8/8/4K2R w K - 0 1' + variant);
    const preview = premoveBoard(castle, [{ from: 'e1', to: variant ? 'h1' : 'g1' }], 'w');
    assert.equal(preview.get('g1').type, 'k');
    assert.equal(preview.get('f1').type, 'r');
    const promotion = premoveBoard(new Chess('7k/P7/8/8/8/8/8/7K w - - 0 1' + variant), [{ from: 'a7', to: 'a8' }], 'w');
    assert.equal(promotion.get('a8').type, 'q');
  }
  await server.listen();
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  async function scenario({ pgn = '1. e4', side = 'w', bot = false, result = null, test }) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
    page.setDefaultTimeout(12000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const position = new StandardChess(); if (pgn) position.loadPgn(pgn);
    const sent = [];
    let reject = false;
    const snapshot = () => ({
      id: 'premove-game', white_id: side === 'w' ? userId : otherId, black_id: side === 'b' ? userId : bot ? null : otherId,
      white_name: 'White player', black_name: 'Black player', white_rating: 1200, black_rating: 1200,
      is_bot: bot, minutes: 5, white_ms: 300000, black_ms: 300000, pgn: position.pgn(), fen: position.fen(), turn: position.turn(),
      version: position.history().length, ply_count: position.history().length, result, reason: result ? 'Checkmate' : '', rated: false,
      white_delta: 0, black_delta: 0, draw_offer: null, created_at: new Date().toISOString(), finished_at: null,
      turn_started_at: new Date().toISOString(), white_seen_at: new Date().toISOString(), black_seen_at: new Date().toISOString(),
      white_disconnected_at: null, black_disconnected_at: null,
    });
    await page.route('https://premove-check.supabase.co/**', async route => {
      const path = new URL(route.request().url()).pathname;
      let data;
      if (path.endsWith('/user')) data = user;
      else if (path.endsWith('/player_progress')) data = { progress: {} };
      else if (path.endsWith('/player_games')) data = [];
      else if (path.endsWith('/multiplayer')) {
        const input = route.request().postDataJSON();
        if (input.action === 'move') {
          sent.push(input);
          if (reject) return route.fulfill({ status: 409, contentType: 'application/json', body: '{"error":"Move rejected"}' });
          assert.equal(input.version, position.history().length, 'move uses the current server version');
          position.move({ from: input.from, to: input.to, ...(input.promotion ? { promotion: input.promotion } : {}) });
        }
        data = { game: snapshot(), server_now: new Date().toISOString() };
      } else throw new Error(`Unexpected API ${path}`);
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
    });
    await page.addInitScript(({ user }) => {
      localStorage.setItem('sb-premove-check-auth-token', JSON.stringify({ access_token: 'fake', refresh_token: 'fake', expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user }));
      localStorage.setItem('neon-knights-sound-v1', 'off'); localStorage.setItem('neon-knights-music-v1', 'off');
      localStorage.setItem('arcade-gambit-storage-notice-v1', 'acknowledged');
    }, { user });
    try {
      await page.goto(`${server.resolvedUrls.local[0]}#online/premove-game`);
      const board = page.getByRole('group', { name: result ? 'Final chessboard' : 'Online chessboard' });
      await board.waitFor();
      const square = name => board.locator(`[data-square="${name}"]`);
      const queue = async (from, to) => { await square(from).click(); await square(to).click(); };
      const opponent = async san => {
        position.move(san);
        await page.evaluate(() => window.dispatchEvent(new Event('online')));
      };
      await test({ page, board, square, queue, opponent, position, sent, rejectMoves: () => { reject = true; } });
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  }
  for (const bot of [false, true]) await scenario({ bot, test: async ({ page, square, opponent, sent }) => {
    await square('g1').click();
    await opponent('e5');
    await page.waitForFunction(() => document.querySelector('[data-square="e5"]')?.getAttribute('aria-label')?.includes('Black p'));
    await page.waitForFunction(() => document.querySelector('[data-square="g1"]')?.getAttribute('aria-pressed') === 'true');
    await square('f3').click();
    await page.waitForFunction(() => document.querySelector('[data-square="f3"]')?.getAttribute('aria-label')?.includes('White n'));
    assert.equal(sent.length, 1, 'preserved selection completes the intended move');
  } });
  await scenario({ pgn: '1. f3 e5 2. g4 Qh4#', bot: true, result: '0-1', test: async ({ page, board, square }) => {
    const heading = page.getByRole('heading', { name: 'Defeat', exact: true });
    await heading.waitFor();
    assert.ok((await heading.boundingBox()).y < (await board.boundingBox()).y);
    assert.equal(await board.locator('[data-square]').count(), 64);
    assert.match(await square('e1').getAttribute('aria-label'), /checkmated king/);
    assert.match(await square('h4').getAttribute('aria-label'), /Black q/);
  } });
  await scenario({ test: async ({ page, square, opponent, sent }) => {
    const source = await square('g1').boundingBox(), target = await square('f3').boundingBox();
    await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
    await page.mouse.down();
    await page.mouse.move(source.x + source.width / 2 + 8, source.y + source.height / 2 - 8);
    await opponent('e5');
    await page.waitForFunction(() => document.querySelector('[data-square="e5"]')?.getAttribute('aria-label')?.includes('Black p'));
    assert.equal(await page.locator('.piece-drag-ghost:visible').count(), 1, 'opponent move preserves an active drag');
    await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 5 });
    await page.mouse.up();
    await page.waitForFunction(() => document.querySelector('[data-square="f3"]')?.getAttribute('aria-label')?.includes('White n'));
    assert.equal(sent.length, 1);
  } });
  await scenario({ pgn: '[SetUp "1"]\n[FEN "4k3/8/8/8/8/8/q7/R3K3 b Q - 0 1"]\n\n*', test: async ({ page, square, opponent }) => {
    await square('a1').click();
    await opponent('Qxa1+');
    await page.waitForFunction(() => document.querySelector('[data-square="a1"]')?.getAttribute('aria-label')?.includes('Black q'));
    await page.waitForFunction(() => document.querySelector('[data-square="a1"]')?.getAttribute('aria-pressed') === 'false');
  } });
  await scenario({ test: async ({ page, board, square, queue, opponent, sent }) => {
    for (let i = 0; i < 12; i++) await queue(i % 2 ? 'f3' : 'g1', i % 2 ? 'g1' : 'f3');
    await queue('b1', 'c3');
    await page.getByRole('button', { name: 'Cancel all 13 premoves', exact: true }).waitFor();
    assert.equal(sent.length, 0, 'queuing sends no server moves');
    await square('d1').click();
    await opponent('e5');
    await page.getByRole('button', { name: 'Cancel all 12 premoves', exact: true }).waitFor();
    assert.equal(sent.length, 1);
    assert.equal(await square('d1').getAttribute('aria-pressed'), 'true', 'automatic premove keeps another selected piece');
    await opponent('Nc6');
    await page.getByRole('button', { name: 'Cancel all 11 premoves', exact: true }).waitFor();
    assert.deepEqual(sent.map(move => `${move.from}${move.to}`), ['g1f3', 'f3g1']);
    assert.equal(await square('d1').getAttribute('aria-pressed'), 'true');
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.locator('.online-game-info').evaluate(panel => panel.scrollWidth <= panel.clientWidth), true, 'long queue fits the mobile sidebar');
    await page.screenshot({ path: '.tmp/premove-queue-mobile.png', fullPage: true });
    await board.press('Escape');
    assert.equal(await page.locator('.premove-cancel').count(), 0);
    await queue('g1', 'f3');
    await board.click({ button: 'right' });
    assert.equal(await page.locator('.premove-cancel').count(), 0);
  } });
  await scenario({ side: 'b', pgn: '', test: async ({ page, queue, opponent, sent }) => {
    await queue('g8', 'f6'); await queue('f6', 'g8');
    await opponent('e4');
    await page.getByRole('button', { name: 'Cancel premove', exact: true }).waitFor();
    assert.equal(sent[0].from, 'g8');
    await opponent('d4');
    await page.waitForFunction(() => !document.querySelector('.premove-cancel'));
    assert.equal(sent[1].to, 'g8');
  } });
  await scenario({ pgn: '1. e4 e5 2. f3', test: async ({ page, queue, opponent, sent }) => {
    await queue('g1', 'h3'); await queue('d2', 'd4');
    await opponent('Qh4+');
    await page.getByText('Premoves canceled: the next move is no longer legal.').waitFor();
    assert.equal(sent.length, 0, 'illegal premove is canceled before a server request');
    assert.equal(await page.locator('.premove-cancel').count(), 0, 'dependent tail is canceled');
  } });
  await scenario({ test: async ({ page, queue, opponent, sent, rejectMoves }) => {
    await queue('g1', 'f3'); await queue('b1', 'c3');
    rejectMoves(); await opponent('e5');
    await page.getByText(/Move rejected.*confirmed position has been restored/).waitFor();
    assert.equal(sent.length, 1, 'rejected premove is never retried');
    assert.equal(await page.locator('.premove-cancel').count(), 0);
  } });
  for (const cancel of [false, true]) await scenario({ pgn: '[SetUp "1"]\n[FEN "7k/P6p/8/8/8/8/8/7K b - - 0 1"]\n\n*', test: async ({ page, queue, opponent, sent }) => {
    await queue('a7', 'a8'); await queue('h1', 'g1');
    await opponent('h6');
    const menu = page.getByRole('menu', { name: 'Promote your pawn' });
    await menu.waitFor();
    assert.equal(sent.length, 0, 'queued promotion waits for an explicit choice');
    if (cancel) {
      await page.getByRole('button', { name: 'Cancel premove', exact: true }).click();
      assert.equal(await menu.count(), 0, 'cancel queue also cancels its pending promotion');
      assert.equal(sent.length, 0);
    } else {
      await menu.getByRole('menuitem', { name: 'Promote to Knight', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('[data-square="a8"]')?.getAttribute('aria-label')?.includes('White n'));
      assert.equal(sent[0].promotion, 'n');
      await opponent('Kh7');
      await page.waitForFunction(() => !document.querySelector('.premove-cancel'));
      assert.equal(sent[1].from, 'h1', 'tail resumes only on the next real turn');
    }
  } });
  for (const mode of ['standard', 'freestyle']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
    page.setDefaultTimeout(12000);
    const localGame = new Chess(mode === 'freestyle' ? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1 chess960' : undefined);
    localGame.move('e4');
    const matchId = crypto.randomUUID();
    await page.addInitScript(({ pgn, matchId }) => {
      localStorage.setItem('neon-knights-sound-v1', 'off'); localStorage.setItem('neon-knights-music-v1', 'off');
      localStorage.setItem('arcade-gambit-storage-notice-v1', 'acknowledged');
      localStorage.setItem('neon-knights-saved-match-v1', JSON.stringify({ id: matchId, bossIndex: 1, pgn, tauntIndex: 0 }));
      const NativeWorker = window.Worker;
      window.Worker = class {
        constructor(url, options) {
          if (!String(url).includes('stockfish-19')) return new NativeWorker(url, options);
        }
        postMessage(command) {
          if (command === 'uci') queueMicrotask(() => this.onmessage?.({ data: 'option name UCI_Elo type spin default 1320 min 1320 max 3190\noption name UCI_LimitStrength type check default false\nuciok' }));
          if (command === 'isready') queueMicrotask(() => this.onmessage?.({ data: 'readyok' }));
          if (command.startsWith('go ')) window.replyToBoss = move => this.onmessage?.({ data: `bestmove ${move}` });
        }
        terminate() { window.replyToBoss = null; }
      };
    }, { pgn: localGame.pgn(), matchId });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(`${server.resolvedUrls.local[0]}#battle`);
      const board = page.getByRole('group', { name: /^Chess board\./ });
      await board.waitFor();
      const square = name => board.locator(`[data-square="${name}"]`);
      const reply = async move => {
        await page.waitForFunction(() => typeof window.replyToBoss === 'function');
        await page.evaluate(move => window.replyToBoss(move), move);
      };
      await square('g1').click();
      await reply('e7e5');
      await page.waitForFunction(() => document.querySelector('[data-square="e5"]')?.getAttribute('aria-label')?.includes('Boss peasant'));
      assert.equal(await square('g1').getAttribute('aria-pressed'), 'true', 'boss move preserves piece selection');
      await square('f3').click();
      for (const [from, to] of [['f3','g1'], ['g1','f3'], ['b1','c3']]) { await square(from).click(); await square(to).click(); }
      await page.getByRole('button', { name: 'Cancel all 3 premoves', exact: true }).waitFor();
      await reply('b8c6');
      await page.getByRole('button', { name: 'Cancel all 2 premoves', exact: true }).waitFor();
      await page.waitForFunction(matchId => {
        const record = JSON.parse(localStorage.getItem('arcade-chess-history-v1') ?? '[]').find(match => match.id === matchId);
        return record?.pgn.includes('Ng1');
      }, matchId);
      await reply('g8f6');
      await page.getByRole('button', { name: 'Cancel premove', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Cancel premove', exact: true }).click();
      assert.equal(await page.locator('.premove-cancel').count(), 0);
      for (const [from, to] of [['h2','g3'], ['b1','c3']]) { await square(from).click(); await square(to).click(); }
      await reply('a7a6');
      await page.getByText('PREMOVE CANCELED - MOVE IS NO LONGER LEGAL').waitFor();
      assert.equal(await page.locator('.premove-cancel').count(), 0, 'illegal boss premove clears its dependent tail');
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  }
  console.log('PASS unbounded same-piece queues, selection across human/bot moves, White/Black execution order, one send per turn, illegal-check cancellation, server rejection, Escape/right-click, castling/promotion previews');
} finally { await browser?.close(); await server.close(); }
