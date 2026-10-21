import assert from 'node:assert/strict';
import { chromium } from 'file:///C:/Users/mikem/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
import { createServer } from 'vite';
import { Chess, freestyleFen } from './src/chess.ts';

const server = await createServer({ server: { host: '127.0.0.1', port: 0, open: false } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const url = server.resolvedUrls.local[0];
  for (const mode of ['standard', 'freestyle']) for (const savedWidth of [undefined, 1600, 360]) {
    const game = new Chess(mode === 'freestyle' ? freestyleFen(518) : undefined);
    game.move('e4');
    const page = await browser.newPage({ viewport: { width: 2560, height: 1080 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    try {
      await page.addInitScript(({ pgn, savedWidth }) => {
        localStorage.setItem('neon-knights-sound-v1', 'off');
        localStorage.setItem('neon-knights-music-v1', 'off');
        localStorage.setItem('neon-knights-saved-match-v1', JSON.stringify({ bossIndex: 0, pgn, tauntIndex: 0 }));
        if (savedWidth) localStorage.setItem('arcade-chess-board-size-v1', String(savedWidth));
      }, { pgn: game.pgn(), savedWidth });
      await page.goto(`${url}#battle`);
      await page.locator('.chessboard .square').first().waitFor();
      async function resize(width, height) {
        await page.setViewportSize({ width, height });
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      }
      async function assertFit(label) {
        await page.waitForFunction(() => {
          const frame = document.querySelector('.board-frame').getBoundingClientRect();
          return frame.top >= 0 && frame.bottom <= innerHeight + 1 && frame.left >= 0 && frame.right <= innerWidth + 1;
        }, null, { timeout: 3000 });
        const layout = await page.evaluate(() => {
          const rect = selector => {
            const box = document.querySelector(selector).getBoundingClientRect();
            return { top: box.top, bottom: box.bottom, left: box.left, right: box.right, width: box.width, height: box.height };
          };
          const squares = [...document.querySelectorAll('.chessboard .square')];
          return { viewport: [innerWidth, innerHeight], board: rect('.chessboard'), frame: rect('.board-frame'), footer: rect('.site-footer'),
            clickable: squares.every(square => {
              const box = square.getBoundingClientRect();
              return document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)?.closest('[data-square]') === square;
            }), count: squares.length };
        });
        const detail = `${mode}, saved ${savedWidth ?? 'auto'}, ${label}: ${JSON.stringify(layout)}`;
        assert.equal(layout.count, 64, detail);
        assert(layout.frame.top >= 0 && layout.frame.bottom <= layout.viewport[1] + 1, detail);
        assert(layout.frame.left >= 0 && layout.frame.right <= layout.viewport[0] + 1, detail);
        assert(Math.abs(layout.board.width - layout.board.height) < 1, detail);
        assert(layout.board.width > 0 && layout.clickable, detail);
        if (layout.viewport[0] > 760) assert(layout.frame.bottom + 11 <= layout.footer.top + 1, detail);
      }
      for (const [width, height] of [[5120,1440],[3440,1440],[2560,1080],[2560,720],[1920,1080],[1366,768],[1024,600],[768,1024],[390,844],[320,640],[740,360]]) {
        await resize(width, height);
        await page.evaluate(() => window.scrollTo(0, 0));
        await assertFit(`${width}x${height}`);
      }
      await resize(2560, 720);
      const scroll = page.locator('.opponent-column .side-column-content');
      const before = await page.locator('.chessboard').boundingBox();
      assert(await scroll.evaluate(element => element.scrollHeight > element.clientHeight));
      await scroll.evaluate(element => { element.scrollTop = element.scrollHeight; });
      assert.deepEqual(await page.locator('.chessboard').boundingBox(), before);
      await assertFit('independent side-panel scroll');
      for (const name of ['Collapse opponent panel', 'Collapse player panel']) {
        await page.getByRole('button', { name, exact: true }).click();
        await assertFit(name);
      }
      const handle = page.getByRole('button', { name: 'Resize chessboard' });
      await handle.focus();
      await handle.press('End');
      for (let count = 0; count < 20; count++) await handle.press('Shift+ArrowRight');
      await assertFit('manual resize ceiling');
      await resize(1920, 600);
      await assertFit('resized window with saved manual size');
      if (mode === 'freestyle' && savedWidth === undefined) await page.screenshot({ path: '.tmp/board-fit-widescreen.png' });
      assert.deepEqual(errors, []);
      console.log(`PASS ${mode}, saved ${savedWidth ?? 'auto'}: all resolutions, 64 visible/clickable squares, panel scrolling/collapse, manual size and window resize`);
    } finally { await page.close(); }
  }
} finally { await browser?.close(); await server.close(); }
