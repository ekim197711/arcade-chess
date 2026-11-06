import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'file:///C:/Users/mikem/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';

const server = await createServer({ server: { host: '127.0.0.1', port: 0, open: false } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  await mkdir('.tmp', { recursive: true });
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(server.resolvedUrls.local[0]);
    await page.getByRole('button', { name: 'LOG IN', exact: true }).click();
    const dialog = page.getByRole('dialog');
    const checkbox = dialog.getByRole('checkbox');
    const providers = dialog.locator('.social-login-list button');
    const free = dialog.getByRole('radio', { name: /^Free / });
    const veryFree = dialog.getByRole('radio', { name: /^Very free / });
    assert.equal(await free.isChecked(), true);
    await veryFree.check();
    assert.equal(await veryFree.isChecked(), true);
    assert.equal(await free.isChecked(), false);
    assert.equal(await checkbox.isChecked(), false);
    assert.equal(await providers.count(), 3);
    for (const button of await providers.all()) assert.equal(await button.isDisabled(), true);
    await checkbox.check();
    for (const button of await providers.all()) assert.equal(await button.isEnabled(), true);
    await checkbox.uncheck();
    for (const button of await providers.all()) assert.equal(await button.isDisabled(), true);
    const terms = dialog.getByRole('region', { name: 'Full terms of use and liability disclaimer' });
    assert.match(await terms.innerText(), /free accounts, trials/i);
    assert.match(await terms.innerText(), /No disclaimer can guarantee immunity/);
    assert.match(await terms.innerText(), /Multiplayer code of conduct/);
    assert.match(await terms.innerText(), /temporary account freeze, or cancellation of your account/);
    assert.match(await terms.innerText(), /Multiplayer is not currently available/);
    await terms.focus();
    await page.keyboard.press('End');
    const bounds = await dialog.boundingBox();
    assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= viewport.height);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `.tmp/signup-${viewport.width}.png` });
    await checkbox.check();
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'LOG IN', exact: true }).click();
    assert.equal(await checkbox.isChecked(), false);
    await dialog.getByRole('button', { name: 'KEEP PLAYING AS GUEST' }).click();
    assert.equal(await dialog.count(), 0);
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('Signup disclaimer checks passed on desktop and mobile: acceptance gates all providers, resets on close, and terms remain accessible.');
} finally {
  await browser?.close();
  await server.close();
}
