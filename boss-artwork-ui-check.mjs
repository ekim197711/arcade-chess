import assert from 'node:assert/strict';
import { copyFileSync, existsSync, unlinkSync } from 'node:fs';
import { createServer } from 'vite';
import { chromium } from 'file:///C:/Users/mikem/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
import { BOSS_CHARACTERS } from './src/bossArtwork.ts';

const probe = 'public/characters/blunder-benny/inventory-refresh-check.png';
assert(!existsSync(probe), 'temporary inventory probe must not overwrite existing artwork');
const server = await createServer({ server: { host: '127.0.0.1', port: 0, open: false } });
let browser;
async function waitForInventory(includesProbe) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const watched = Object.values(server.watcher.getWatched()).some(files => files.includes('inventory-refresh-check.png'));
    if (server.config.define.__BOSS_PORTRAITS__.includes('inventory-refresh-check') === includesProbe && watched === includesProbe) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Character inventory did not refresh after artwork changed');
}
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
  await page.goto(`${server.resolvedUrls.local[0]}#roster`);
  await page.locator('.boss-line').last().waitFor();
  assert.equal(await page.locator('.boss-line').count(), 59);
  assert.equal(await page.locator('.boss-line .boss-portrait-mascot').count(), 0);
  assert.equal(await page.locator('.boss-line img').count(), 59);
  for (const [index, boss] of BOSS_CHARACTERS.entries()) {
    const image = page.locator('.boss-line').nth(index).locator('img');
    assert.equal(await image.getAttribute('src'), `/boss-thumbnails/${boss.folder}/focused.png`);
    await image.evaluate(image => image.decode());
    assert.equal(await image.evaluate(image => image.naturalWidth),112);
  }
  copyFileSync('public/characters/blunder-benny/focused.png', probe);
  await waitForInventory(true);
  unlinkSync(probe);
  await waitForInventory(false);
  assert.deepEqual(errors, []);
  console.log('PASS 59 ladder portraits decoded, no placeholders, artwork inventory refreshes on image addition and removal');
} finally {
  if (existsSync(probe)) unlinkSync(probe);
  await browser?.close();
  await server.close();
}
