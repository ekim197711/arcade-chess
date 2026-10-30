import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'file:///C:/Users/mikem/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';

const id = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const user = { id, aud: 'authenticated', role: 'authenticated', email: 'ekim197711@gmail.com', app_metadata: {}, user_metadata: { full_name: 'Mike' }, created_at: '2026-01-01T00:00:00Z' };
const live = process.argv.includes('--live');
const apiOrigin = live ? 'https://smdwmvfkyumxuxbnzitq.supabase.co' : 'https://admin-check.supabase.co';
const authStorage = live ? 'sb-smdwmvfkyumxuxbnzitq-auth-token' : 'sb-admin-check-auth-token';
const server = await createServer({ define: {
  'import.meta.env.VITE_SUPABASE_DEV_URL': JSON.stringify('https://admin-check.supabase.co'),
  'import.meta.env.VITE_SUPABASE_DEV_PUBLISHABLE_KEY': JSON.stringify('sb_publishable_test'),
}, server: { host: '127.0.0.1', port: 0, open: false } });
let browser;
try {
  if (!live) await server.listen();
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    let role = 'administrator', targetRole = 'user', targetStatus = 'active', targetUntil = null, heartbeatCount = 0, statsCount = 0, userRequests = 0, failStats = false, failRole = false;
    const changes = [];
    await page.route(`${apiOrigin}/**`, async route => {
      const url = new URL(route.request().url());
      let data;
      if (url.pathname.endsWith('/app_heartbeat')) { heartbeatCount++; data = role; }
      else if (url.pathname.endsWith('/admin_statistics')) {
        statsCount++;
        if (failStats) return route.fulfill({ status: 403, contentType: 'application/json', body: '{"message":"Administrator access required"}' });
        data = { users: 123, online: 7, games: { today: 22, hour: 4, week: 150, month: 600 }, asOf: new Date().toISOString() };
      } else if (url.pathname.endsWith('/admin_users')) {
        userRequests++;
        const { p_search, p_offset } = route.request().postDataJSON();
        assert.equal(p_offset, 0);
        data = p_search ? [{ id: other, email: 'other@example.com', role: targetRole, verified: true, status: targetStatus, until: targetUntil }] : [
          { id, email: user.email, role: 'administrator', verified: true, status: 'active' },
          { id: other, email: 'other@example.com', role: targetRole, verified: true, status: targetStatus, until: targetUntil },
          { id: 'unverified', email: 'unverified@example.com', role: 'user', verified: false, status:'active' },
        ];
      } else if (url.pathname.endsWith('/admin_set_administrator')) {
        const change = route.request().postDataJSON();
        assert.equal(change.p_user_id, other);
        changes.push(change);
        if (failRole) return route.fulfill({ status: 403, contentType: 'application/json', body: '{"message":"Denied"}' });
        targetRole = change.p_enabled ? 'administrator' : 'user';
        data = null;
      } else if (url.pathname.endsWith('/admin_moderate_user')) {
        const change = route.request().postDataJSON();
        assert.equal(change.p_user_id, other); assert(change.p_reason.trim());
        targetStatus = change.p_action === 'restore' ? 'active' : change.p_action === 'ban' ? 'banned' : 'suspended';
        targetUntil = change.p_until;
        data = null;
      } else if (url.pathname.endsWith('/app_account_status')) {
        data = {status:'suspended',reason:'Test account restriction',until:new Date(Date.now()+3600000).toISOString()};
      } else if (url.pathname.endsWith('/player_progress')) data = { progress: {} };
      else if (url.pathname.endsWith('/player_games')) data = [];
      else if (url.pathname.endsWith('/online_players')) data = { rating: 1200 };
      else if (url.pathname.endsWith('/online_games')) data = url.searchParams.get('result') === 'is.null' ? null : [];
      else if (url.pathname.endsWith('/user')) data = user;
      else throw new Error(`Unexpected request ${url.pathname}`);
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
    });
    await page.addInitScript(({ user, authStorage }) => {
      localStorage.setItem(authStorage, JSON.stringify({ access_token: 'fake', refresh_token: 'fake', expires_at: Math.floor(Date.now()/1000)+3600, token_type: 'bearer', user }));
      localStorage.setItem('arcade-gambit-storage-notice-v1', 'acknowledged');
      localStorage.setItem('neon-knights-sound-v1', 'off'); localStorage.setItem('neon-knights-music-v1', 'off');
    }, { user, authStorage });
    await page.clock.install();
    await page.goto(live ? 'https://www.arcadegambit.com/' : server.resolvedUrls.local[0]);
    const link = page.getByRole('link', { name: 'Administration', exact:true });
    await link.waitFor();
    assert.equal(heartbeatCount, 1);
    assert.equal(statsCount, 0, 'Home does not load statistics');
    assert.equal(userRequests, 0, 'Home does not load other users');
    await link.click();
    await page.getByRole('heading', { name: 'Games played in the last month' }).waitFor();
    await page.getByRole('heading', { name: 'Version & deployment', exact: true }).waitFor();
    if (live) {
      const published = await (await page.request.get('https://www.arcadegambit.com/deployment.json')).json();
      const release = page.locator('.admin-release');
      await release.locator('dt').filter({ hasText: /^Deployed$/ }).waitFor();
      assert.equal(await release.locator('dt').filter({ hasText: /^Loaded version$/ }).locator('..').locator('dd').innerText(), 'v' + published.version);
      assert.equal(await release.locator('time').last().getAttribute('datetime'), published.deployedAt);
      assert.equal(await release.getByRole('button', { name: 'Reload app', exact: true }).count(), 0);
    }
    assert.match(await page.locator('.admin-stat-grid').innerText(), /600/);
    await page.getByText('Your account',{exact:true}).waitFor();
    assert.equal(await page.locator('.admin-user-list li').filter({ hasText: user.email }).getByRole('button').count(),0);
    assert.equal(await page.locator('.admin-user-list li').filter({ hasText: 'unverified@example.com' }).getByRole('button',{name:'Make administrator'}).isDisabled(), true);
    const target = page.locator('.admin-user-list li').filter({ hasText: 'other@example.com' });
    await target.getByRole('button', { name: 'Make administrator' }).click();
    await target.getByRole('button', { name: 'Remove administrator' }).waitFor();
    assert.equal(changes[0].p_enabled, true);
    failRole = true;
    await target.getByRole('button', { name: 'Remove administrator' }).click();
    await page.getByRole('alert').waitFor();
    assert.equal(await target.getByRole('button', { name: 'Remove administrator' }).count(), 1, 'Failed mutation retains existing role');
    failRole = false;
    await target.getByRole('button', { name: 'Remove administrator' }).click();
    await target.getByRole('button', { name: 'Make administrator' }).waitFor();
    assert.equal(changes.at(-1).p_enabled, false);
    await target.getByRole('button',{name:'Suspend user'}).click();
    await page.getByLabel('Suspension duration').selectOption('168');
    await page.getByRole('textbox',{name:'Reason',exact:true}).fill('Repeated abusive chat');
    await page.getByRole('button',{name:'Confirm suspension',exact:true}).click();
    await target.getByRole('button',{name:'Restore access',exact:true}).waitFor();
    assert.equal(targetStatus,'suspended'); assert(targetUntil);
    await target.getByRole('button',{name:'Restore access',exact:true}).click();
    await page.getByRole('button',{name:'Confirm restore access',exact:true}).click();
    await target.getByRole('button',{name:'Ban user',exact:true}).waitFor();
    await target.getByRole('button',{name:'Ban user',exact:true}).click();
    await page.getByRole('textbox',{name:'Reason',exact:true}).fill('Repeated abuse');
    await page.getByRole('button',{name:'Cancel',exact:true}).click();
    assert.equal(targetStatus,'active','cancel does not ban');
    await target.getByRole('button',{name:'Ban user',exact:true}).click();
    await page.getByRole('textbox',{name:'Reason',exact:true}).fill('Repeated abuse');
    await page.getByRole('button',{name:'Confirm ban',exact:true}).click();
    await target.getByRole('button',{name:'Restore access',exact:true}).waitFor();
    assert.equal(targetStatus,'banned'); assert.equal(targetUntil,null);
    await page.getByLabel('Find users by email or name').fill('other@');
    await page.getByRole('button', { name: 'Search users' }).click();
    await page.waitForFunction(() => document.querySelectorAll('.admin-user-list li').length === 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `.tmp/administration-${width}.png`, fullPage: true });
    failStats = true;
    await page.getByRole('button', { name: 'Refresh statistics' }).click();
    await page.getByRole('alert').waitFor();
    assert.equal(await page.locator('.admin-stat').count(), 0, 'Failed refresh clears privileged statistics');
    failStats = false;
    role = 'suspended';
    await page.clock.runFor(30_000);
    await page.getByRole('heading',{name:'Account suspended',exact:true}).waitFor();
    await page.getByText('Test account restriction',{exact:true}).waitFor();
    assert.equal(await page.locator('.admin-user-list').count(),0,'suspended admin loses management UI');
    role = 'user';
    await page.clock.runFor(30_000);
    await page.getByText('Administrator access is required to view this page.').waitFor();
    await page.getByRole('link', { name: 'Back to home' }).click();
    assert.equal(await link.count(), 0);
    const count = heartbeatCount;
    await page.evaluate(() => Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }));
    await page.clock.runFor(60_000);
    assert.equal(heartbeatCount,count,'Hidden tabs stop presence heartbeats');
    const visibleHeartbeat = page.waitForResponse(response => response.url().endsWith('/app_heartbeat'));
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await visibleHeartbeat;
    assert.equal(heartbeatCount,count+1);
    await page.evaluate(() => { for (let i=0;i<100;i++) document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForTimeout(100);
    assert.equal(heartbeatCount,count+1,'Repeated visibility events are throttled');
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log(`PASS ${live ? 'deployed' : 'local'} administration UI (simulated API; no real account edits): desktop/mobile, all-admin role management, suspend/ban/restore/cancel, search, self/unverified safeguards, account restriction screen, role revocation and visible-tab presence.`);
} finally { await browser?.close(); await server.close(); }
