import assert from 'node:assert/strict';
import { chromium } from 'file:///C:/Users/mikem/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
import { createServer } from 'vite';
const id = '11111111-1111-4111-8111-111111111111';
const user = { id, aud: 'authenticated', role: 'authenticated', email: 'save@example.com', app_metadata: { provider: 'google' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const server = await createServer({ define: { 'import.meta.env.VITE_SUPABASE_DEV_URL': JSON.stringify('https://save-check.supabase.co'), 'import.meta.env.VITE_SUPABASE_DEV_PUBLISHABLE_KEY': JSON.stringify('sb_publishable_test') }, server: { host: '127.0.0.1', port: 0 } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();
  let progress = { wins: 0, losses: 0, streak: 0, bestStreak: 0, bossesDefeated: 0, freestyleBossesDefeated: 0, progressionVersion: 3 };
  let saves = 0;
  const events = new Set();
  await page.route('https://save-check.supabase.co/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let data = {};
    if (path.endsWith('/player_progress')) data = { progress };
    else if (path.endsWith('/record_game_result')) {
      const event = route.request().postDataJSON();
      const field = event.p_mode === 'freestyle' ? 'freestyleBossesDefeated' : 'bossesDefeated';
      if (!events.has(event.p_event_id)) {
      events.add(event.p_event_id);
      progress = { ...progress, wins: progress.wins + 1, [field]: Math.max(progress[field], event.p_boss_index + 1) };
      saves++;
      }
      data = progress;
    } else if (path.endsWith('/user')) data = user;
    else if (path.endsWith('/player_games') || path.endsWith('/online_games')) data = [];
    else if (path.endsWith('/online_players')) data = { rating: 1200 };
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
  });
  await page.addInitScript(({ user }) => {
    localStorage.setItem('sb-save-check-auth-token', JSON.stringify({ access_token: 'fake', refresh_token: 'fake', expires_at: Math.floor(Date.now()/1000)+3600, token_type: 'bearer', user }));
  }, { user });
  const url = `http://127.0.0.1:${server.httpServer.address().port}/`;
  await page.goto(url);
  await page.evaluate(id => localStorage.setItem(`neon-knights-pending-v1:${id}`, JSON.stringify(Array.from({length: 7}, (_, i) => ({ id: crypto.randomUUID(), result: 'win', bossIndex: i, progressionVersion: 3, mode: i % 2 ? 'freestyle' : 'standard' })))), id);
  await page.reload();
  await page.getByRole('button', { name: 'Game history', exact: true }).waitFor();
  assert.equal(saves, 0, 'home keeps pending wins local until an explicit refresh');
  await page.getByRole('button', { name: 'Game history', exact: true }).click();
  await page.getByRole('button', { name: 'Refresh saved data', exact: true }).click();
  await page.waitForFunction(id => JSON.parse(localStorage.getItem(`neon-knights-pending-v1:${id}`)).length === 2, id);
  assert.equal(saves, 5, 'one explicit refresh flushes at most five wins');
  await page.getByRole('button', { name: 'Refresh saved data', exact: true }).click();
  await page.waitForFunction(id => localStorage.getItem(`neon-knights-pending-v1:${id}`) === '[]', id);
  assert.equal(saves, 7, 'a second refresh saves the remaining wins');
  await page.goto(`${url}#roster`);
  await page.locator('.boss-line-cleared').first().waitFor();
  assert.equal(await page.locator('.boss-line-cleared').count(), 7);
  await page.getByLabel('PLAY MODE', { exact: true }).selectOption('freestyle');
  assert.equal(await page.locator('.boss-line-cleared').count(), 6);
  await page.reload();
  await page.locator('.boss-line-cleared').first().waitFor();
  assert.equal(await page.locator('.boss-line-cleared').count(), 6);
  assert.equal(saves, 7, 'reload does not resubmit saved wins');
  console.log('PASS account saves use explicit bounded home refreshes; both ladders survive reload without duplicate saves');
} finally { await browser?.close(); await server.close(); }
