import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'file:///C:/Users/mikem/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';

const added = [
  ['aurora-glass-3d', 'Aurora Glass 3D'], ['kintsugi-3d', 'Kintsugi 3D'],
  ['tournament-2d', 'Tournament 2D'], ['verdigris-3d', 'Verdigris 3D'], ['woodcut-2d', 'Woodcut 2D'],
];
const names = ['king', 'queen', 'bishop', 'knight', 'rook', 'pawn'];
for (const [style] of added) for (const size of [256, 512]) for (const side of ['white', 'black']) for (const name of names) {
  const png = await readFile(`public/pieces/${style}/${size}/${side}-${name}.png`);
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.equal(png.readUInt32BE(16), size);
  assert.equal(png.readUInt32BE(20), size);
  assert.equal(png[25], 6, `${style}/${side}-${name} has RGBA transparency`);
}

const server = await createServer({ server: { host: '127.0.0.1', port: 0, open: false, watch: null } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const errors = [], failedPieces = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.url().includes('/pieces/') && response.status() >= 400) failedPieces.push(response.url()); });
  await page.addInitScript(() => {
    localStorage.setItem('neon-knights-music-v1', 'off');
    localStorage.setItem('neon-knights-sound-v1', 'off');
    localStorage.setItem('arcade-gambit-storage-notice-v1', 'acknowledged');
    localStorage.setItem('arcade-gambit-analytics-consent-v1', 'denied');
    localStorage.setItem('neon-knights-saved-match-v1', JSON.stringify({ bossIndex: 0, pgn: '1. e4 e5', tauntIndex: 0 }));
  });
  const url = server.resolvedUrls.local[0];
  await page.goto(url);
  const gear = page.getByRole('button', { name: 'Open settings', exact: true });
  await gear.focus(); await gear.press('Enter');
  await page.getByRole('heading', { name: 'Game settings' }).waitFor();
  assert.equal(await page.locator('.settings-button').innerText(), '');
  assert.equal(await page.locator('.settings-button svg').count(), 1);

  const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  async function choose(style, label) {
    const button = page.getByRole('button', { name: `Use ${label} piece design`, exact: true });
    while (!await button.count() && await page.getByRole('button', { name: 'Previous piece sets', exact: true }).isEnabled()) {
      await page.getByRole('button', { name: 'Previous piece sets', exact: true }).click();
    }
    while (!await button.count() && await page.getByRole('button', { name: 'Next piece sets', exact: true }).isEnabled()) {
      await page.getByRole('button', { name: 'Next piece sets', exact: true }).click();
    }
    await button.click();
    await page.waitForFunction(style => localStorage.getItem('arcade-chess-piece-theme-v1') === style, style);
    assert.equal(await button.getAttribute('aria-pressed'), 'true');
    await settle();
  }
  async function assertScreen(label) {
    await page.waitForFunction(() => {
      const element = document.querySelector('.settings-page') ?? document.querySelector('.board-frame');
      if (!element) return false;
      const box = element.getBoundingClientRect();
      return box.left >= -1 && box.top >= -1 && box.right <= innerWidth + 1 && box.bottom <= innerHeight + 1;
    }, null, { timeout: 5000 });
    const result = await page.evaluate(() => {
      const rect = selector => {
        const { left, top, right, bottom, width, height } = document.querySelector(selector).getBoundingClientRect();
        return { left, top, right, bottom, width, height };
      };
      return { width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight, gear: rect('.settings-button'), icon: rect('.settings-button svg'),
        content: rect(document.querySelector('.settings-page') ? '.settings-page' : '.board-frame') };
    });
    const detail = `${label}: ${JSON.stringify(result)}`;
    assert(result.scrollWidth <= result.width + 1 && result.scrollHeight <= result.height + 1, detail);
    for (const box of [result.gear, result.content]) {
      assert(box.left >= -1 && box.top >= -1 && box.right <= result.width + 1 && box.bottom <= result.height + 1, detail);
    }
    assert(Math.abs((result.gear.left + result.gear.right) / 2 - (result.icon.left + result.icon.right) / 2) < 1, detail);
    assert(Math.abs((result.gear.top + result.gear.bottom) / 2 - (result.icon.top + result.icon.bottom) / 2) < 1, detail);
  }

  // Decode both armies, including promotion pieces that may be absent on board.
  for (const [style] of added) await page.evaluate(async ({ style, names }) => {
    for (const side of ['white', 'black']) for (const name of names) {
      const image = new Image(); image.src = `/pieces/${style}/256/${side}-${name}.png`;
      await image.decode();
      if (image.naturalWidth !== 256 || image.naturalHeight !== 256) throw new Error('Invalid piece size');
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
      const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
      if (context.getImageData(0, 0, 1, 1).data[3] !== 0) throw new Error('Opaque sprite background');
    }
  }, { style, names });

  for (const [width, height] of [[1440, 900], [1280, 720], [1024, 600], [390, 844], [320, 640]]) {
    await page.setViewportSize({ width, height }); await settle();
    for (const [style, label] of added) { await choose(style, label); await assertScreen(`${width}x${height} ${label}`); }
    await page.reload();
    await page.getByRole('button', { name: 'Use Woodcut 2D piece design', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Use Woodcut 2D piece design', exact: true }).getAttribute('aria-pressed'), 'true');
    if (width === 1440 || width === 390) await page.screenshot({ path: `.tmp/piece-settings-${width}.png` });
    console.log(`PASS ${width}x${height}: five new sets, settings pagination, saved selection and centered gear`);
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(url + '#battle');
  await page.locator('.chessboard .piece-artwork').first().waitFor();
  await page.getByRole('button', { name: 'Looks', exact: true }).click();
  const picker = page.getByRole('combobox', { name: 'Battle piece set', exact: true });
  for (const [style] of added) {
    await picker.selectOption(style);
    await page.waitForFunction(style => document.querySelector('.chessboard .piece-artwork')?.getAttribute('src')?.includes(`/${style}/`) && !document.querySelector('.piece-style-loading'), style);
    await page.locator('.chessboard .piece-artwork').evaluateAll(async images => { await Promise.all(images.map(image => image.decode())); });
    for (const [width, height] of [[1440, 900], [1280, 720], [1024, 600], [390, 844], [320, 640]]) {
      await page.setViewportSize({ width, height }); await settle();
      await assertScreen(`${width}x${height} board ${style}`);
      assert.equal(await page.locator('.chessboard .piece-artwork').count(), 32);
      const overflow = await page.locator('.chessboard .piece-artwork').evaluateAll(images => images.some(image => {
        const piece = image.getBoundingClientRect(), square = image.closest('[data-square]').getBoundingClientRect();
        return piece.left < square.left - 1 || piece.right > square.right + 1 || piece.top < square.top - 1 || piece.bottom > square.bottom + 1;
      }));
      assert.equal(overflow, false, `${style} stays inside its squares at ${width}x${height}`);
      if (style === 'aurora-glass-3d' && (width === 1440 || width === 390)) await page.screenshot({ path: `.tmp/piece-board-${width}.png` });
    }
    await page.setViewportSize({ width: 1440, height: 900 }); await settle();
  }
  assert.deepEqual(failedPieces, []); assert.deepEqual(errors, []);
  console.log('PASS: all 120 PNG exports, both armies, all five sets on live boards at five viewport sizes, no missing assets or browser errors');
} finally { await browser?.close(); await server.close(); }
