import assert from 'node:assert/strict';
import { chromium } from 'file:///C:/Users/mikem/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
import { createServer } from 'vite';

const baseline = process.argv.includes('--baseline');
const server = await createServer({ server: { host: '127.0.0.1', port: 0, open: false } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1566, height: 888 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(15000);
  await page.addInitScript(() => {
    localStorage.setItem('neon-knights-sound-v1', 'off');
    localStorage.setItem('neon-knights-music-v1', 'off');
    localStorage.setItem('arcade-chess-piece-theme-v1', 'granite-3d');
  });
  await page.goto(server.resolvedUrls.local[0]);
  await page.getByRole('button', { name: /^Insert one coin/ }).click();
  await page.getByRole('button', { name: 'Play using one credit' }).click();
  await page.getByRole('button', { name: /^Fight against/ }).click();

  const viewports = baseline ? [[1566, 888]] : [[1566, 888], [768, 1024], [390, 844], [320, 640]];
  const themes = baseline ? ['Granite 3D'] : ['Classic 2D', 'Granite 3D', 'Medieval 3D', 'Sci-Fi 3D', 'Sports 3D'];
  for (const [width, height] of viewports) {
    await page.setViewportSize({ width, height });
    for (const theme of themes) {
      await page.getByRole('button', { name: `Use ${theme} piece design` }).click();
      await page.waitForFunction(() => !document.querySelector('.piece-style-loading'));
      await page.locator('.chessboard .piece-artwork').evaluateAll(async (images) => {
        await Promise.all(images.map(image => image.decode()));
      });
      const measurements = await page.locator('.chessboard .piece-artwork').evaluateAll(images => images.map(image => {
        const square = image.closest('.square').getBoundingClientRect();
        const box = image.getBoundingClientRect();
        const wrapper = image.parentElement.getBoundingClientRect();
        return {
          name: image.closest('.square').getAttribute('aria-label'),
          piece: image.src.split('/').pop(),
          square: { x: square.x, y: square.y, width: square.width, height: square.height },
          box: { x: box.x, y: box.y, width: box.width, height: box.height },
          wrapper: { width: wrapper.width, height: wrapper.height },
          natural: [image.naturalWidth, image.naturalHeight],
          objectFit: getComputedStyle(image).objectFit,
          gridRows: getComputedStyle(image.parentElement).gridTemplateRows,
        };
      }));
      if (baseline) {
        console.log('Before fix:', JSON.stringify(measurements.slice(0, 2), null, 2));
        continue;
      }
      assert.equal(measurements.length, 32);
      for (const { name, piece, square, box, objectFit } of measurements) {
        const label = `${width}px ${theme}: ${name}`;
        const scale = piece.includes('pawn') ? 0.68 : piece.includes('rook') ? 0.74 : piece.includes('knight') ? 0.78 : 0.84;
        const inset = (1 - scale) / 2;
        assert.equal(objectFit, 'contain', label);
        assert.ok(Math.abs(box.width - square.width * scale) < 1, `${label}: width`);
        assert.ok(Math.abs(box.height - square.height * scale) < 1, `${label}: height`);
        assert.ok(Math.abs(box.x - (square.x + square.width * inset)) < 1, `${label}: horizontal centering`);
        assert.ok(Math.abs(box.y + box.height - (square.y + square.height * 0.92)) < 1, `${label}: bottom gap`);
        assert.ok(box.x >= square.x && box.y >= square.y && box.x + box.width <= square.x + square.width && box.y + box.height <= square.y + square.height, `${label}: overflow`);
      }
      console.log(`PASS ${width}x${height} ${theme}: all 32 pieces horizontally centered, bottom-aligned, contained, and aspect-preserving`);
      if (width === 1566 && theme === 'Granite 3D') {
        await page.locator('.chessboard').screenshot({ path: 'piece-sizing-desktop.png' });
      }
    }
  }
} finally {
  await browser?.close();
  await server.close();
}
