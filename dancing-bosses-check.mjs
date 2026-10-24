import assert from 'node:assert/strict';
import { mkdirSync, readdirSync } from 'node:fs';
import { BOSS_CHARACTERS, bossPortrait, resolveBossCharacter } from './src/bossArtwork.ts';
import { chromium } from 'file:///C:/Users/mikem/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
import { createServer } from 'vite';

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
  await page.goto(server.resolvedUrls.local[0]);
  await page.locator('.dancing-boss').last().waitFor({ state: 'attached' });
  const inventory = Object.fromEntries(readdirSync('public/characters', { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => [entry.name,
    readdirSync(`public/characters/${entry.name}`).filter(file => file.endsWith('.png')).map(file => file.slice(0, -4)),
  ]));
  const illustratedBosses = BOSS_CHARACTERS.filter(boss => bossPortrait(resolveBossCharacter(boss.name, inventory), inventory));
  assert.equal(await page.locator('.dancing-boss').count(), illustratedBosses.length);
  assert.equal(await page.locator('.dancing-boss img').count(), illustratedBosses.length);
  for (const boss of BOSS_CHARACTERS.filter(boss => !illustratedBosses.includes(boss))) {
    assert.equal(await page.getByRole('button', { name: `Hear a taunt from ${boss.name}`, exact: true }).count(), 0);
  }
  await page.evaluate(async () => {
    await Promise.all([...document.querySelectorAll('.dancing-boss img')].map(image => image.decode()));
  });
  // Seek the route to check direction and offscreen transitions without waiting for a loop.
  const route = page.locator('.dancing-boss-route').first();
  const seek = async phase => {
    await route.evaluate((element, phase) => {
      const animation = element.getAnimations()[0];
      animation.pause();
      animation.currentTime = phase * Number(animation.effect.getTiming().duration);
    }, phase);
    return route.boundingBox();
  };
  const topA = await seek(.1), topB = await seek(.2);
  assert(topB.x > topA.x && Math.abs(topB.y - topA.y) < 1);
  const edge = await seek(.48);
  assert(edge.x > 1440);
  const bottomA = await seek(.7), bottomB = await seek(.8);
  assert(bottomB.x < bottomA.x && bottomA.y > 800);
  // Put a boss in an exposed background area for a real pointer click.
  await seek(.1);
  mkdirSync('.tmp', { recursive: true });
  await page.screenshot({ path: '.tmp/dancing-bosses-desktop.png' });
  const target = await page.evaluate(() => {
    for (const animation of document.querySelector('.dancing-bosses').getAnimations({ subtree: true })) animation.pause();
    for (const button of document.querySelectorAll('.dancing-boss')) {
      const box = button.getBoundingClientRect();
      const x = box.x + box.width / 2, y = box.y + box.height / 2;
      if (x > 0 && x < innerWidth && y > 0 && y < innerHeight && document.elementFromPoint(x, y)?.closest('button') === button) {
        return { x, y, name: button.title };
      }
    }
  });
  assert(target, 'at least one background boss should be visible and clickable');
  await page.mouse.click(target.x, target.y);
  const quip = page.locator('.dancing-boss-quip');
  await quip.waitFor();
  assert.equal(await quip.locator('strong').innerText(), target.name);
  const firstTaunt = await quip.locator('p').innerText();
  await page.mouse.click(target.x, target.y);
  assert.notEqual(await quip.locator('p').innerText(), firstTaunt);
  await page.getByRole('button', { name: 'Dismiss boss taunt' }).click();
  assert.equal(await quip.count(), 0);
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const coin = page.getByRole('button', { name: /^Insert one coin/ });
    await coin.click();
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  mkdirSync('.tmp', { recursive: true });
  await page.screenshot({ path: '.tmp/dancing-bosses-desktop.png' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await page.locator('.dancing-boss-route').last().evaluate(element => getComputedStyle(element).animationPlayState), 'paused');
  assert.equal(await page.locator('.dancing-boss').last().evaluate(element => getComputedStyle(element).animationName), 'none');
  await page.getByRole('button', { name: 'Open settings' }).click();
  assert.equal(await page.locator('.dancing-bosses').count(), 0);
  assert.deepEqual(errors, []);
  console.log('PASS only bosses with real artwork, no emoji placeholders, route directions, real clicks and changing taunts, working coin/settings controls, no overflow, reduced motion, home-only display');
} finally { await browser?.close(); await server.close(); }
