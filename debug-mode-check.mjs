import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'file:///C:/Users/mikem/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';

const server = await createServer({ server: { host: '127.0.0.1', port: 0, open: false } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('neon-knights-sound-v1', 'off');
    localStorage.setItem('neon-knights-music-v1', 'off');
  });
  const url = server.resolvedUrls.local[0];
  await page.goto(`${url}#settings`);
  const toggle = page.getByRole('button', { name: 'Debug mode', exact: true });
  assert.equal(await toggle.getAttribute('aria-pressed'), 'false');
  await page.goto(`${url}#roster`);
  assert.equal(await page.locator('.boss-line[aria-disabled="true"]').count(), 58);
  assert.equal(await page.locator('.boss-line').last().isDisabled(), true);
  assert.match(page.url(), /#roster$/);
  await page.goto(`${url}#settings`);
  await toggle.click();
  await page.reload();
  assert.equal(await toggle.getAttribute('aria-pressed'), 'true');
  assert.equal(await page.evaluate(() => localStorage.getItem('arcade-chess-debug-mode-v1')), 'true');
  const progressBefore = await page.evaluate(() => localStorage.getItem('neon-knights-progress-v1'));
  for (const mode of ['standard', 'freestyle']) {
    await page.goto(`${url}#roster`);
    await page.getByLabel('PLAY MODE', { exact: true }).selectOption(mode);
    assert.equal(await page.locator('.boss-line[aria-disabled="true"]').count(), 0);
    await page.locator('.boss-line').last().click();
    await page.getByRole('button', { name: /Fight against Checkmate Cindy/ }).click();
    const autoMate = page.getByRole('button', { name: 'AUTO CHECKMATE', exact: true });
    await autoMate.waitFor();
    if (mode === 'standard') {
      await page.getByRole('button', { name: 'SAVE FOR LATER', exact: true }).click();
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('neon-knights-saved-match-v1')).debug), true);
      await page.reload();
      await page.getByRole('button', { name: /Resume saved match against Checkmate Cindy/ }).click();
      await autoMate.waitFor();
    }
    const before = await page.evaluate(() => JSON.parse(localStorage.getItem('neon-knights-saved-match-v1')));
    await autoMate.click();
    await page.getByRole('heading', { name: 'Victory', exact: true }).waitFor();
    await page.getByText('Debug auto checkmate (simulated)', { exact: true }).waitFor();
    await page.getByRole('region', { name: 'Checkmate Cindy wants a rematch' }).waitFor();
    await page.waitForFunction(() => !localStorage.getItem('neon-knights-saved-match-v1'));
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem('arcade-chess-history-v1'))[0]);
    assert.equal(after.debug, true);
    assert.equal(after.result, 'win');
    // Simulated wins retain an honest game history instead of inventing moves.
    assert.equal(after.pgn, before.pgn);
    assert.equal(after.opponent, 'Checkmate Cindy');
    assert.equal(await page.evaluate(() => localStorage.getItem('neon-knights-progress-v1')), progressBefore);
    await page.reload();
    await page.getByText('DEBUG MATCH COMPLETE · TEST RESULT', { exact: true }).waitFor();
  }
  await page.goto(`${url}#settings`);
  await toggle.click();
  await page.goto(`${url}#roster`);
  assert.equal(await page.locator('.boss-line[aria-disabled="true"]').count(), 58);
  await page.reload();
  assert.equal(await page.locator('.boss-line[aria-disabled="true"]').count(), 58);
  await page.getByLabel('PLAY MODE', { exact: true }).selectOption('standard');
  await page.locator('.boss-line').first().click();
  await page.getByRole('button', { name: /Fight against Blunder Benny/ }).click();
  await page.locator('.chessboard').waitFor();
  assert.equal(await page.getByRole('button', { name: 'AUTO CHECKMATE', exact: true }).count(), 0);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('neon-knights-saved-match-v1')).debug), false);
  assert.deepEqual(errors, []);
  console.log('PASS debug default off, persisted toggle, all 59 bosses unlocked in both modes, save/resume, simulated checkmate victory and rematch, honest test history, unchanged progress, locks restored when disabled');
} finally { await browser?.close(); await server.close(); }
