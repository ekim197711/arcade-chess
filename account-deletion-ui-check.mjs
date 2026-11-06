import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'file:///C:/Users/mikem/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';

const id = '11111111-1111-4111-8111-111111111111';
const user = { id, aud: 'authenticated', role: 'authenticated', email: 'delete@example.com', app_metadata: {}, user_metadata: { full_name: 'Delete test', arcade_plan: 'free' }, created_at: '2026-01-01T00:00:00Z' };
const server = await createServer({ define: {
  'import.meta.env.VITE_SUPABASE_DEV_URL': JSON.stringify('https://delete-check.supabase.co'),
  'import.meta.env.VITE_SUPABASE_DEV_PUBLISHABLE_KEY': JSON.stringify('sb_publishable_test'),
}, server: { host: '127.0.0.1', port: 0, open: false } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    let deletes = 0, fail = true;
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://delete-check.supabase.co/**', async route => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/delete_own_account')) {
        deletes++;
        assert.deepEqual(route.request().postDataJSON(), {});
        return route.fulfill({ status: fail ? 500 : 204, contentType: 'application/json', body: fail ? '{"message":"test failure"}' : '' });
      }
      if (url.pathname.endsWith('/logout')) return route.fulfill({ status: 204 });
      let data;
      if (url.pathname.endsWith('/player_progress')) data = { progress: {} };
      else if (url.pathname.endsWith('/online_players')) data = { rating: 1200 };
      else if (url.pathname.endsWith('/player_games')) data = [];
      else if (url.pathname.endsWith('/online_games')) data = url.searchParams.get('result') === 'is.null' ? null : [];
      else if (url.pathname.endsWith('/app_heartbeat')) data = 'player';
      else if (url.pathname.endsWith('/user')) data = user;
      else throw new Error(`Unexpected request: ${url.pathname}`);
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
    });
    await page.addInitScript(({ user }) => {
      if (sessionStorage.getItem('deletion-test-initialized')) return;
      sessionStorage.setItem('deletion-test-initialized', 'yes');
      localStorage.setItem('sb-delete-check-auth-token', JSON.stringify({ access_token: 'fake', refresh_token: 'fake', expires_at: Math.floor(Date.now()/1000)+3600, token_type: 'bearer', user }));
      for (const prefix of ['neon-knights-account-v1:', 'neon-knights-pending-v1:', 'neon-knights-merge-v1:', 'neon-knights-saved-match-v1:', 'arcade-chess-history-v1:']) localStorage.setItem(prefix+user.id, '[]');
      localStorage.setItem(`arcade-chess-history-v1:${user.id}:pending`, '[]');
      localStorage.setItem('neon-knights-account-v1:another-account', 'keep');
    }, { user });
    await page.goto(server.resolvedUrls.local[0]);
    await page.getByRole('button', { name: 'Account for Delete test' }).click();
    const profile = page.getByRole('dialog');
    assert.match(await profile.innerText(), /cannot be recovered or recreated later/);
    const button = profile.getByRole('button', { name: 'DELETE MY ACCOUNT', exact: true });
    page.once('dialog', async dialog => {
      assert.equal(dialog.type(), 'confirm');
      assert.match(dialog.message(), /Are you really sure/);
      assert.match(dialog.message(), /permanently deleted/);
      await dialog.dismiss();
    });
    await button.click();
    assert.equal(deletes, 0, 'Cancellation must not call deletion');
    page.once('dialog', dialog => dialog.accept());
    await button.click();
    await profile.getByRole('alert').waitFor();
    assert.equal(deletes, 1);
    assert.equal(await button.isEnabled(), true);
    assert.ok(await page.evaluate(id => localStorage.getItem(`neon-knights-account-v1:${id}`), id));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `.tmp/account-deletion-${width}.png` });
    fail = false;
    page.once('dialog', dialog => dialog.accept());
    await button.click();
    await page.getByRole('button', { name: 'LOG IN', exact: true }).waitFor();
    assert.equal(deletes, 2);
    const remaining = await page.evaluate(id => Object.keys(localStorage).filter(key => key.includes(id) || key === 'sb-delete-check-auth-token'), id);
    assert.deepEqual(remaining, [], 'Account caches and session must be removed');
    assert.equal(await page.evaluate(() => localStorage.getItem('neon-knights-account-v1:another-account')), 'keep');
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('Account deletion UI passed on desktop/mobile: warning, confirmation, cancellation, failed request/retry, cache erasure and guest reload.');
} finally { await browser?.close(); await server.close(); }
