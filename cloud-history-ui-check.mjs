import assert from 'node:assert/strict';
import { chromium } from 'file:///C:/Users/mikem/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
import { createServer } from 'vite';
const id = '11111111-1111-4111-8111-111111111111';
const match = { id: 'cloud-game', startedAt: '2026-10-20T12:00:00Z', updatedAt: '2026-10-20T12:00:00Z', bossIndex: 1, opponent: 'Cloud opponent', playerName: 'Cloud Player', elo: 150, color: 'w', pgn: '1. e4 e5', result: 'unfinished', reason: 'Match in progress' };
const server = await createServer({ define: { 'import.meta.env.VITE_SUPABASE_DEV_URL': JSON.stringify('https://cloud-check.supabase.co'), 'import.meta.env.VITE_SUPABASE_DEV_PUBLISHABLE_KEY': JSON.stringify('sb_publishable_test') }, server: { host: '127.0.0.1', port: 0, open: false } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const user = { id, aud: 'authenticated', role: 'authenticated', email: 'cloud@example.com', app_metadata: { provider: 'google' }, user_metadata: { full_name: 'Cloud Player', avatar_url: 'https://avatar.example.com/player.png' }, created_at: '2026-01-01T00:00:00Z' };
  let cloud = [match], offline = false, uploads = 0;
  await page.route('https://avatar.example.com/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="red"/></svg>' }));
  const handleApi = async route => {
    const url = new URL(route.request().url());
    if (offline && url.pathname.startsWith('/rest/')) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Offline' }) });
    let data = {};
    if (url.pathname.endsWith('/player_progress')) data = { progress: { wins: 2, losses: 1, streak: 1, bestStreak: 2, bossesDefeated: 2, freestyleBossesDefeated: 0, progressionVersion: 3 } };
    else if (url.pathname.endsWith('/player_games')) data = cloud.map(game => ({ game }));
    else if (url.pathname.endsWith('/save_player_game')) { data = route.request().postDataJSON().p_game; cloud = [data, ...cloud.filter(game => game.id !== data.id)]; uploads++; }
    else if (url.pathname.endsWith('/user')) {
      if (route.request().method() === 'PUT') Object.assign(user.user_metadata, route.request().postDataJSON().data);
      data = user;
    }
    else if (url.pathname.endsWith('/logout')) return route.fulfill({ status: 204 });
    else throw new Error(`Unexpected request ${url.pathname}`);
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
  };
  await page.route('https://cloud-check.supabase.co/**', handleApi);
  await page.addInitScript(({user}) => {
    if (!localStorage.getItem('plan-test-initialized')) {
      localStorage.setItem('arcade-chess-pending-signup-plan-v1', 'very-free');
      localStorage.setItem('plan-test-initialized', 'true');
    }
    localStorage.setItem('sb-cloud-check-auth-token', JSON.stringify({ access_token: 'fake-access-token', refresh_token: 'fake-refresh-token', expires_at: Math.floor(Date.now()/1000)+3600, token_type: 'bearer', user }));
    localStorage.setItem('neon-knights-sound-v1', 'off'); localStorage.setItem('neon-knights-music-v1', 'off');
  }, { user });
  await page.goto(server.resolvedUrls.local[0]);
  await page.getByText('Cloud opponent', { exact: true }).waitFor();
  await page.getByRole('img', { name: "Cloud Player's avatar" }).first().waitFor();
  await page.getByRole('button', { name: 'Account for Cloud Player' }).click();
  await page.getByText('PLAN: VERY FREE', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  assert.equal(user.user_metadata.arcade_plan, 'very-free');
  await page.getByRole('button', { name: 'Resume game' }).click();
  await page.waitForURL('**/#battle');
  await page.waitForFunction(id => JSON.parse(localStorage.getItem(`arcade-chess-history-v1:${id}`) ?? '[]').some(game => game.id === 'cloud-game'), id);
  await page.waitForFunction(() => document.querySelectorAll('.history-item').length === 0);
  offline = true;
  await page.locator('[data-square="g1"]').click();
  await page.locator('[data-square="f3"]').click();
  await page.waitForFunction(id => JSON.parse(localStorage.getItem(`arcade-chess-history-v1:${id}`) ?? '[]').some(game => game.id === 'cloud-game' && game.pgn.includes('Nf3')), id);
  await page.reload();
  await page.getByRole('button', { name: 'Resume game' }).waitFor();
  await page.getByRole('button', { name: 'Resume game' }).click();
  await page.waitForURL('**/#battle');
  await page.getByText('Game history is saved on this device.', { exact: false }).waitFor();
  offline = false;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.getByText('Game history synced to your account.', { exact: true }).waitFor();
  assert.ok(uploads > 0);
  assert.ok(cloud.find(game => game.id === 'cloud-game').pgn.includes('Nf3'), 'offline move reaches the cloud');
  // A different browser profile has only auth credentials, without any game cache.
  const freshContext = await browser.newContext();
  const freshPage = await freshContext.newPage();
  await freshPage.route('https://cloud-check.supabase.co/**', handleApi);
  await freshPage.addInitScript(({ user }) => {
    localStorage.setItem('sb-cloud-check-auth-token', JSON.stringify({ access_token: 'fake-access-token', refresh_token: 'fake-refresh-token', expires_at: Math.floor(Date.now()/1000)+3600, token_type: 'bearer', user }));
    localStorage.setItem('neon-knights-sound-v1', 'off'); localStorage.setItem('neon-knights-music-v1', 'off');
  }, { user });
  await freshPage.goto(server.resolvedUrls.local[0]);
  await freshPage.getByRole('button', { name: 'Resume game' }).waitFor();
  const restored = await freshPage.evaluate(id => JSON.parse(localStorage.getItem(`arcade-chess-history-v1:${id}`)), id);
  assert.ok(restored.find(game => game.id === 'cloud-game').pgn.includes('Nf3'), 'new device restores full cloud position');
  await freshContext.close();
  await page.getByRole('button', { name: 'Account for Cloud Player' }).click();
  await page.getByRole('button', { name: /sign out/i }).click();
  await page.getByRole('button', { name: 'LOG IN', exact: true }).waitFor();
  assert.equal(await page.getByText('Cloud opponent', { exact: true }).count(), 0);
  assert.equal(await page.evaluate(() => localStorage.getItem('arcade-chess-history-v1')), null);
  assert.deepEqual(errors, []);
  console.log('PASS cloud history hydration, OAuth avatar, resume from PGN, offline account cache, retry on reconnect, sign-out isolation, no browser errors');
} finally { await browser?.close(); await server.close(); }
