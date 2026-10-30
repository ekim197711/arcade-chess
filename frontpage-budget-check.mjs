import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'file:///C:/Users/mikem/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';

const id = '11111111-1111-4111-8111-111111111111';
const user = { id, aud: 'authenticated', role: 'authenticated', email: 'budget@example.com', app_metadata: {}, user_metadata: { full_name: 'Budget player', arcade_plan: 'very-free' }, created_at: '2026-01-01T00:00:00Z' };
const history = Array.from({ length: 600 }, (_, index) => ({ id: `budget-${index}`, startedAt: '2026-10-20T12:00:00Z', updatedAt: '2026-10-20T12:00:00Z', bossIndex: 1, opponent: `Boss ${index}`, elo: 150, color: 'w', pgn: '1. e4 e5', result: 'win', reason: 'Checkmate' }));
const online = Array.from({length: 120}, (_, index) => ({ id: `online-${index}`, white_id: id, black_id: '22222222-2222-4222-8222-222222222222', white_name: 'Budget player', black_name: `Human ${index}`, white_rating: 1200, black_rating: 1200, is_bot: false, created_at: '2026-10-22T12:00:00Z', result: '1-0', ply_count: 4, minutes: 5, rated: true }));
const server = await createServer({ define: {
  'import.meta.env.VITE_SUPABASE_DEV_URL': JSON.stringify('https://budget-check.supabase.co'),
  'import.meta.env.VITE_SUPABASE_DEV_PUBLISHABLE_KEY': JSON.stringify('sb_publishable_test'),
}, server: { host: '127.0.0.1', port: 0, open: false } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  for (const failReads of [false, true]) {
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const requests = [];
    let saves = 0, progressWrites = 0, heartbeats = 0;
    await page.route('https://budget-check.supabase.co/**', async route => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/app_heartbeat')) {
        heartbeats++;
        return route.fulfill({ status: failReads ? 503 : 200, contentType: 'application/json', body: failReads ? '{"message":"Unavailable"}' : '"player"' });
      }
      requests.push({ path: url.pathname, method: route.request().method(), limit: url.searchParams.get('limit'), offset: url.searchParams.get('offset') });
      if (url.pathname.startsWith('/functions/')) throw new Error('Home must never invoke an Edge Function');
      if (failReads && url.pathname.startsWith('/rest/')) return route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"Unavailable"}' });
      let data;
      if (url.pathname.endsWith('/player_progress')) data = { progress: {} };
      else if (url.pathname.endsWith('/online_players')) data = { rating: 1200 };
      else if (url.pathname.endsWith('/player_games')) {
        assert.equal(url.searchParams.get('limit'), '50');
        const offset = Number(url.searchParams.get('offset') ?? 0);
        data = history.slice(offset, offset + 50).map(game => ({ game }));
      } else if (url.pathname.endsWith('/online_games')) {
        if (url.searchParams.get('result') === 'is.null') data = null;
        else {
          assert.equal(url.searchParams.get('limit'), '50');
          const offset = Number(url.searchParams.get('offset') ?? 0);
          data = online.slice(offset, offset + 50);
        }
      } else if (url.pathname.endsWith('/save_player_game')) { saves++; data = route.request().postDataJSON().p_game; }
      else if (url.pathname.endsWith('/record_game_result') || url.pathname.endsWith('/merge_guest_progress')) { progressWrites++; data = {}; }
      else if (url.pathname.endsWith('/user')) data = user;
      else throw new Error(`Unexpected ${url.pathname}`);
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
    });
    await page.addInitScript(({ user, history }) => {
      localStorage.setItem('sb-budget-check-auth-token', JSON.stringify({ access_token: 'fake', refresh_token: 'fake', expires_at: Math.floor(Date.now()/1000) + 3600, token_type: 'bearer', user }));
      localStorage.setItem(`arcade-chess-history-v1:${user.id}`, JSON.stringify(history));
      localStorage.setItem(`neon-knights-pending-v1:${user.id}`, JSON.stringify(Array.from({length: 100}, (_, index) => ({ id: `pending-${index}`, result: 'win', bossIndex: 1, progressionVersion: 3, mode: 'standard' }))));
      localStorage.setItem('neon-knights-progress-v1', JSON.stringify({wins: 1, losses: 0, streak: 1, bestStreak: 1, bossesDefeated: 1, freestyleBossesDefeated: 0, progressionVersion: 3}));
      localStorage.setItem('neon-knights-sound-v1', 'off'); localStorage.setItem('neon-knights-music-v1', 'off');
      localStorage.setItem('arcade-gambit-storage-notice-v1', 'acknowledged');
    }, { user, history });
    await page.clock.install();
    try {
      await page.goto(server.resolvedUrls.local[0]);
      await page.clock.runFor(1000);
      const card = page.getByRole('region', { name: 'Historic games' });
      const refresh = card.getByRole('button', { name: 'Refresh saved data', exact: true });
      await refresh.waitFor();
      await page.waitForFunction(() => ![...document.querySelectorAll('button')].some(button => button.textContent === 'Refresh saved data' && button.disabled));
      await page.waitForTimeout(150);
      assert.equal(requests.length, 5, 'initial home load is exactly five bounded reads, even with large queues or server errors');
      assert.equal(heartbeats, 1, 'one separate presence heartbeat also resolves the account role');
      assert.equal(saves, 0, '600 cached games are not uploaded on home');
      assert.equal(progressWrites, 0, 'pending results and guest merges are not replayed on home');
      assert.equal(await card.locator('.history-item').count(), 50, 'only 50 rows are parsed and rendered initially');
      const baseline = requests.length;
      await page.clock.fastForward(10 * 60 * 1000);
      await page.evaluate(() => { for (let i = 0; i < 100; i++) { window.dispatchEvent(new Event('focus')); window.dispatchEvent(new Event('online')); } });
      await page.waitForTimeout(200);
      assert.equal(requests.length, baseline, 'ten minutes, 100 focus events and 100 reconnect events produce no requests');
      await page.evaluate(() => { location.hash = 'settings'; });
      await page.waitForURL('**/#settings');
      await page.evaluate(() => { location.hash = 'home'; });
      await refresh.waitFor();
      await page.waitForTimeout(200);
      assert.equal(requests.length, baseline, 'card remounts reuse cached success or failure without requests');
      if (!failReads) {
        await card.getByRole('button', { name: 'Show more saved games', exact: true }).click();
        assert.equal(await card.locator('.history-item').count(), 100);
        assert.equal(requests.length, baseline, 'rendering more cached rows makes no requests');
        const moreOnline = page.waitForResponse(response => response.url().includes('/online_games'));
        await card.getByRole('button', { name: 'Load older online games', exact: true }).click();
        await moreOnline;
        await page.waitForTimeout(100);
        assert.equal(requests.length, baseline + 1, 'older online history requires one explicit page request');
        const moreBosses = page.waitForResponse(response => response.url().includes('/player_games'));
        await page.getByRole('button', { name: 'Load older boss games', exact: true }).click();
        await moreBosses;
        await page.waitForTimeout(100);
        assert.equal(requests.length, baseline + 2, 'older boss history requires one explicit page request');
        await refresh.click();
        await page.waitForFunction(() => ![...document.querySelectorAll('button')].some(button => button.textContent === 'Refreshing...'));
        await page.waitForTimeout(200);
        assert.equal(saves, 5, 'explicit sync flushes at most five history saves');
        assert.equal(progressWrites, 6, 'explicit sync flushes five results and one guest merge');
        const afterManual = requests.length;
        await page.clock.fastForward(5 * 60 * 1000);
        await page.waitForTimeout(150);
        assert.equal(requests.length, afterManual, 'remaining pending queues never start an automatic follow-up');
        const pendingBefore = await page.evaluate(id => JSON.parse(localStorage.getItem(`arcade-chess-history-v1:${id}:pending`)), id);
        await page.reload();
        await page.clock.runFor(1000);
        await refresh.waitFor();
        await page.waitForFunction(() => ![...document.querySelectorAll('button')].some(button => button.textContent === 'Refresh saved data' && button.disabled));
        await page.waitForTimeout(150);
        const pendingAfter = await page.evaluate(id => JSON.parse(localStorage.getItem(`arcade-chess-history-v1:${id}:pending`)), id);
        assert.deepEqual(pendingAfter, pendingBefore, 'reload restores the durable queue without requeuing verified saves');
        assert.equal(saves, 5, 'reload never starts uploading the remaining queue');
      }
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  }
  console.log('PASS home request budget: 5 initial data reads plus separate presence heartbeat, zero automatic game/progress writes, bounded histories/rows, no idle/focus/reconnect/remount data retries, explicit paging and five-save batches');
} finally { await browser?.close(); await server.close(); }
