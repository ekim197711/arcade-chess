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
  assert.ok(premoveBoard(game, [], 'w').targets('g1').includes('e2'), 'allow recapturing a currently friendly piece');
  assert.ok(!premoveBoard(game, [], 'w').targets('d1').includes('e1'), 'never preview a capture of our king');
  const kingRecapture = premoveBoard(new Chess('7k/8/8/8/8/8/8/4KR2 b - - 0 1'), [{from:'e1',to:'f1'}], 'w');
  assert.equal(kingRecapture.get('f1').type,'k','recapturing a rook without castling rights is a king move');
  assert.equal(kingRecapture.get('g1'),undefined,'recapture must not invent castling');
  for (const variant of ['', ' chess960']) {
    const castle = new Chess('4k3/8/8/8/8/8/8/4K2R w K - 0 1' + variant);
    const preview = premoveBoard(castle, [{ from: 'e1', to: variant ? 'h1' : 'g1' }], 'w');
    assert.equal(preview.get('g1').type, 'k');
    assert.equal(preview.get('f1').type, 'r');
    const promotion = premoveBoard(new Chess('7k/P7/8/8/8/8/8/7K w - - 0 1' + variant), [{ from: 'a7', to: 'a8' }], 'w');
    assert.equal(promotion.get('a8').type, 'q');
  }
  await server.listen();
  browser = process.argv.includes('--firefox')
    ? await (await import(process.env.PLAYWRIGHT_FIREFOX_MODULE ?? 'file:///C:/Users/mikem/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs')).firefox.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_FIREFOX_EXECUTABLE })
    : await chromium.launch({ channel: 'msedge', headless: true });
  async function scenario({ pgn = '1. e4', side = 'w', bot = false, result = null, test }) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
    page.setDefaultTimeout(30000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const position = new StandardChess(); if (pgn) position.loadPgn(pgn);
    const sent = [];
    let reject = false, botPending = null;
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
      else if (path.endsWith('/app_heartbeat')) data = 'user';
      else if (path.endsWith('/online_social')) data = { friends: [], messages: [], reactions: [], emojis_enabled: true, peer_emojis_enabled: true };
      else if (path.endsWith('/online_state')) {
        const current = snapshot();
        data = { server_now: new Date().toISOString(), edge_required: !!botPending };
        if (route.request().postDataJSON().p_version === current.version) data.presence = { game_id: current.id, version: current.version, white_seen_at: current.white_seen_at, black_seen_at: current.black_seen_at, white_disconnected_at: null, black_disconnected_at: null };
        else data.game = current;
      }
      else if (path.endsWith('/multiplayer')) {
        const input = route.request().postDataJSON();
        if (input.action === 'state' && botPending) { position.move(botPending); botPending = null; }
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
      await page.goto(`${server.resolvedUrls.local[0]}#online/premove-game`, {waitUntil:"domcontentloaded"});
      const board = page.getByRole('group', { name: result ? 'Final chessboard' : 'Online chessboard' });
      await board.waitFor();
      const square = name => board.locator(`[data-square="${name}"]`);
      const queue = async (from, to) => { await square(from).click(); await square(to).click(); };
      const opponent = async san => {
        if (bot) botPending = san; else position.move(san);
        await page.evaluate(() => window.dispatchEvent(new Event('online')));
      };
      await test({ page, board, square, queue, opponent, position, sent, rejectMoves: () => { reject = true; } });
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  }

  await scenario({test:async({page,square,opponent,sent})=>{
    await page.evaluate(()=>{
      window.motionCalls=[];
      const animate=Element.prototype.animate;
      Element.prototype.animate=function(frames,options){
        window.motionCalls.push({square:this.closest('[data-square]')?.dataset.square,duration:options.duration,frames});
        return animate.call(this,frames,options);
      };
      window.savedSquare=document.querySelector('[data-square="g1"]');
      localStorage.setItem('arcade-move-animation-seconds','0.7');
      window.dispatchEvent(new Event('arcade-move-animation-changed'));
    });
    await square('g1').click(); await opponent('e5');
    await page.waitForFunction(()=>window.motionCalls.some(call=>call.square==='e5'));
    assert(await page.evaluate(()=>window.savedSquare===document.querySelector('[data-square="g1"]')),'opponent move keeps square mounted');
    assert.equal(await square('g1').getAttribute('aria-pressed'),'true');
    await square('f3').click();
    await page.waitForFunction(()=>window.motionCalls.some(call=>call.square==='f3'));
    assert.equal(sent.length,1);
    assert(await page.evaluate(()=>window.motionCalls.every(call=>call.duration===700)));
    await page.evaluate(()=>{localStorage.setItem('arcade-move-animation-seconds','0');window.dispatchEvent(new Event('arcade-move-animation-changed'));window.motionCalls=[];});
    await opponent('Nc6');
    await page.waitForFunction(()=>document.querySelector('[data-square="c6"]')?.dataset.piece==='bn');
    assert.equal(await page.evaluate(()=>window.motionCalls.length),0,'zero disables animations');
    await page.reload({waitUntil:'domcontentloaded'});
    await page.getByRole('group',{name:'Online chessboard'}).waitFor();
    assert.equal(await page.evaluate(()=>localStorage.getItem('arcade-move-animation-seconds')),'0');
  }});
  console.log('PASS native move duration, opponent and player slides, persistent zero disables motion, board nodes and selection survive opponent reply');
} finally { await browser?.close(); await server.close(); }
