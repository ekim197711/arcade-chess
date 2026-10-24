import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createServer } from 'vite';
import { chromium } from 'file:///C:/Users/mikem/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';

const server = await createServer({ server: { host: '127.0.0.1', port: 0, open: false } });
let browser;
try {
  const { BOSS_CHARACTERS } = await server.ssrLoadModule('/src/bossArtwork.ts');
  const { bossRematchPlea } = await server.ssrLoadModule('/src/bossRematches.ts');
  const pleas = BOSS_CHARACTERS.map(boss => bossRematchPlea(boss.name));
  assert.equal(new Set(pleas).size, 59);
  assert(pleas.every(plea => plea.length > 40));
  const matches = BOSS_CHARACTERS.map((boss, index) => ({
    id: `victory-${index}`, startedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    bossIndex: index, opponent: boss.name, elo: 100 + index * 50, color: 'b',
    pgn: '1. f3 e5 2. g4 Qh4#', result: 'win', reason: 'Checkmate',
  }));
  matches.push(...['loss', 'draw'].map(result => ({ ...matches[0], id: result, result })));
  await server.listen();
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(matches => {
    localStorage.setItem('arcade-chess-history-v1', JSON.stringify(matches));
    localStorage.setItem('neon-knights-sound-v1', 'off');
    localStorage.setItem('neon-knights-music-v1', 'off');
  }, matches);
  const url = server.resolvedUrls.local[0];
  for (const index of [0, 1, 46, 47, 58]) {
    const boss = BOSS_CHARACTERS[index];
    await page.goto(`${url}#result/victory-${index}`);
    const panel = page.getByRole('region', { name: `${boss.name} wants a rematch` });
    await panel.waitFor();
    assert.equal(await panel.locator('blockquote').innerText(), pleas[index]);
    if (existsSync(`public/characters/${boss.folder}/angry.png`)) {
      const portrait = panel.locator('img');
      assert.match(await portrait.getAttribute('src'), new RegExp(`${boss.folder}/angry.png$`));
      await portrait.evaluate(image => image.decode());
      assert(await portrait.evaluate(image => image.naturalWidth > 0));
    } else assert.equal(await panel.locator('.result-boss-fallback').count(), 1);
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      const box = await panel.boundingBox();
      assert(box.width > 0 && box.x >= 0 && box.x + box.width <= width);
      assert(await panel.evaluate(element => element.scrollWidth <= element.clientWidth + 1));
    }
  }
  for (const result of ['loss', 'draw']) {
    await page.goto(`${url}#result/${result}`);
    await page.locator('.match-result').waitFor();
    assert.equal(await page.locator('.result-rematch').count(), 0);
  }
  assert.deepEqual(errors, []);
  console.log('PASS 59 unique rematch pleas, matching angry portraits, missing-art fallback, desktop/mobile layout, victory-only display');
} finally {
  await browser?.close();
  await server.close();
}
