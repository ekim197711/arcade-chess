import assert from 'node:assert/strict';
import { chromium } from 'file:///C:/Users/mikem/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
import { createServer } from 'vite';

const id = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const user = { id, aud: 'authenticated', role: 'authenticated', email: 'history@example.com', app_metadata: {}, user_metadata: { full_name: 'History Player' }, created_at: '2026-01-01T00:00:00Z' };
const standard = { id: 'standard', startedAt: '2026-10-20T12:00:00Z', updatedAt: '2026-10-20T12:00:00Z', bossIndex: 1, opponent: 'Standard boss', elo: 150, color: 'w', pgn: '1. e4 e5', result: 'win', reason: 'Checkmate' };
const freestyle = { ...standard, id: 'freestyle', opponent: 'Freestyle boss', pgn: '[Variant "Chess960"]\n[SetUp "1"]\n[FEN "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"]\n\n1. e4 e5 *' };
const human = { id: 'human-game', white_id: other, black_id: id, white_name: 'Human opponent', black_name: 'History Player', white_rating: 1350, black_rating: 1250, is_bot: false, created_at: '2026-10-22T12:00:00Z', finished_at: '2026-10-22T12:10:00Z', pgn: '1. e4 e5', ply_count: 2, minutes: 5, result: '0-1', rated: true };
const practice = { ...human, id: 'practice-game', white_id: id, black_id: null, black_name: 'Practice bot', is_bot: true, result: '1/2-1/2', rated: false, created_at: '2026-10-21T12:00:00Z' };
const ongoing = { ...human, id: 'ongoing-game', white_name: 'Active opponent', result: null, finished_at: null, created_at: '2026-10-23T12:00:00Z' };
const server = await createServer({ define: {
  'import.meta.env.VITE_SUPABASE_DEV_URL': JSON.stringify('https://history-check.supabase.co'),
  'import.meta.env.VITE_SUPABASE_DEV_PUBLISHABLE_KEY': JSON.stringify('sb_publishable_test'),
}, server: { host: '127.0.0.1', port: 0, open: false } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /same key|React/.test(message.text())) errors.push(message.text()); });
  let reads = 0, writes = 0, failedWrites = 0, rejectUploads = false;
  let cloud = [standard, freestyle];
  let homeGame = null, homeReads = 0;
  const requests = [];
  await page.route('https://history-check.supabase.co/**', async route => {
    const url = new URL(route.request().url());
    requests.push(url.pathname);
    let data;
    if (url.pathname.endsWith('/player_progress')) data = { progress: {} };
    else if (url.pathname.endsWith('/player_games')) data = cloud.map(game => ({ game: Object.fromEntries(Object.entries(game).reverse()) }));
    else if (url.pathname.endsWith('/save_player_game')) {
      if (rejectUploads) {
        failedWrites++;
        return route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"Offline"}' });
      }
      writes++;
      data = route.request().postDataJSON().p_game;
      cloud = [data, ...cloud.filter(game => game.id !== data.id)];
    }
    else if (url.pathname.endsWith('/online_players')) data = { rating: 1250 };
    else if (url.pathname.endsWith('/online_games')) {
      assert.equal(url.searchParams.get('or'), `(white_id.eq.${id},black_id.eq.${id})`, 'history is scoped to the signed-in player');
      reads++;
      assert.ok(!url.searchParams.get('select').split(',').includes('pgn'), 'front-page history excludes full PGNs');
      data = [ongoing, human, practice];
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    else if (url.pathname.endsWith('/multiplayer')) { homeReads++; data = { game: homeGame, server_now: new Date().toISOString() }; }
    else if (url.pathname.endsWith('/user')) data = user;
    else throw new Error(`Unexpected request ${url.pathname}`);
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
  });
  await page.addInitScript(({ user, matches }) => {
    localStorage.setItem('sb-history-check-auth-token', JSON.stringify({ access_token: 'fake', refresh_token: 'fake', expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user }));
    localStorage.setItem('neon-knights-sound-v1', 'off');
    localStorage.setItem('neon-knights-music-v1', 'off');
    localStorage.setItem('arcade-gambit-storage-notice-v1', 'acknowledged');
    const key = `arcade-chess-history-v1:${user.id}`;
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(matches));
  }, { user, matches: [standard, freestyle] });
  await page.clock.install();
  await page.goto(server.resolvedUrls.local[0]);
  await page.clock.runFor(1000);
  const card = page.getByRole('region', { name: 'Historic games' });
  const filter = card.getByRole('combobox', { name: 'Game type' });
  await card.getByText('5 saved', { exact: true }).waitFor();
  assert.equal(writes, 0, 'cached games already saved in the cloud are not uploaded again, regardless of key order');
  const idleRequests = requests.length;
  await page.clock.fastForward(90000);
  await page.waitForTimeout(250);
  assert.equal(requests.length, idleRequests, '90 seconds idle produces no Supabase requests');
  await page.evaluate(() => { for (let i = 0; i < 12; i++) window.dispatchEvent(new Event('focus')); });
  await page.waitForResponse(response => response.url().includes('/online_games'));
  await page.waitForTimeout(250);
  const afterFocus = requests.length;
  assert.ok(afterFocus - idleRequests <= 5, 'focus burst is coalesced to one refresh per resource');
  await page.evaluate(() => { for (let i = 0; i < 12; i++) window.dispatchEvent(new Event('focus')); });
  await page.waitForTimeout(250);
  assert.equal(requests.length, afterFocus, 'fresh data is not reloaded on repeated focus');
  assert.equal(await filter.inputValue(), 'all');
  assert.equal(await card.locator('.history-item').count(), 5);
  assert.deepEqual(await card.locator('.history-item > span:first-child > strong').allTextContents(), ['Active opponent', 'Human opponent', 'Practice bot', 'Standard boss', 'Freestyle boss']);
  const colors = await card.locator('.history-type-standard, .history-type-freestyle, .history-type-human, .history-type-practice').evaluateAll(rows => [...new Set(rows.map(row => getComputedStyle(row).backgroundColor))]);
  assert.equal(colors.length, 4, 'each type has its own row color');
  for (const [type, count] of [['standard', 1], ['freestyle', 1], ['human', 2], ['practice', 1]]) {
    await filter.selectOption(type);
    assert.equal(await card.locator('.history-item').count(), count);
    assert.equal(await card.locator(`.history-type-${type}`).count(), count);
  }
  await filter.selectOption('human');
  const finished = card.locator('.history-item').filter({ hasText: 'Human opponent' });
  assert.ok((await finished.innerText()).includes('Victory'));
  assert.ok((await finished.innerText()).includes('You played Black'));
  assert.equal(await finished.getByRole('link', { name: 'Review' }).getAttribute('href'), '#online/review/human-game');
  assert.equal(await card.getByRole('button', { name: 'Resume game' }).count(), 1);
  await filter.selectOption('all');
  await card.scrollIntoViewIfNeeded();
  const before = await card.boundingBox();
  const previousReads = reads;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForResponse(response => response.url().includes('/online_games'));
  assert.ok(reads > previousReads);
  assert.equal((await card.boundingBox()).y, before.y, 'background refresh does not move the history card');
  assert.equal(await filter.inputValue(), 'all');
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await card.locator('header').evaluate(header => header.scrollWidth <= header.clientWidth), true, 'mobile toolbar fits');
  await page.screenshot({ path: '.tmp/history-types-mobile.png', fullPage: true });
  cloud = cloud.map(match => match.id === 'standard' ? { ...match, updatedAt: '2030-01-01T00:00:00Z' } : match);
  rejectUploads = true;
  await page.evaluate(({ id }) => {
    const key = `arcade-chess-history-v1:${id}`;
    const matches = JSON.parse(localStorage.getItem(key));
    const match = matches.find(match => match.id === 'standard');
    match.pgn = '1. e4 e5 2. Nf3';
    match.updatedAt = '2026-10-28T12:00:00Z';
    localStorage.setItem(key, JSON.stringify(matches));
  }, { id });
  await page.reload();
  await page.clock.runFor(1000);
  await page.getByText('Game history is saved on this device.', { exact: false }).waitFor();
  assert.ok(failedWrites > 0, 'unsaved local changes are attempted');
  rejectUploads = false;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForFunction(() => ![...document.querySelectorAll('[role="status"]')].some(node => node.textContent.includes('Game history is saved on this device.')));
  assert.equal(writes, 1, 'only the unsaved match is uploaded on reconnect');
  assert.ok(cloud.find(match => match.id === 'standard').pgn.includes('Nf3'), 'clock differences do not discard an unsaved move');
  for (const hiddenAtExpiry of [false, true]) {
    const disconnected = new Date(Date.now() - 14000).toISOString();
    homeGame = { ...ongoing, black_seen_at: disconnected, white_seen_at: disconnected, black_disconnected_at: disconnected, white_disconnected_at: disconnected };
    await page.reload();
    await page.clock.runFor(500);
    await page.getByRole('timer', { name: 'Seconds before auto-resign' }).waitFor();
    const initialReads = homeReads;
    homeGame = null; // Server will adjudicate the disconnected game on inspection.
    await page.clock.fastForward(4000);
    assert.equal(homeReads, initialReads, 'active countdown runs locally without polling');
    if (hiddenAtExpiry) await page.evaluate(() => Object.defineProperty(document, 'hidden', { configurable: true, value: true }));
    const inspection = hiddenAtExpiry ? null : page.waitForResponse(response => response.url().includes('/multiplayer'));
    await page.clock.fastForward(4000);
    if (hiddenAtExpiry) {
      assert.equal(homeReads, initialReads, 'hidden tab does not inspect expiry');
      await page.evaluate(() => {
        delete document.hidden;
        window.dispatchEvent(new Event('focus'));
      });
    } else await inspection;
    await page.getByRole('timer', { name: 'Seconds before auto-resign' }).waitFor({ state: 'detached' });
    assert.equal(homeReads, initialReads + 1, 'one inspection at expiry or on returning to the tab');
    const afterExpiry = requests.length;
    await page.clock.fastForward(60000);
    assert.equal(requests.length, afterExpiry, 'no polling after the active game has ended');
  }
  const guest = await browser.newPage();
  await guest.goto(server.resolvedUrls.local[0]);
  const guestCard = guest.getByRole('region', { name: 'Historic games' });
  await guestCard.getByRole('combobox', { name: 'Game type' }).selectOption('human');
  await guestCard.getByText('No games of this type yet.').waitFor();
  assert.equal(await guestCard.locator('.history-item').count(), 0, 'guest cannot see account history');
  assert.deepEqual(errors, []);
  console.log('PASS combined history, filters/colors/links, mobile/guest isolation, zero idle requests for 90 seconds, throttled focus, lean history query, no repeat uploads, offline-save retry, local countdown and single expiry check, hidden-tab deferral');
} finally { await browser?.close(); await server.close(); }
