import assert from 'node:assert/strict';
import { chromium } from 'file:///C:/Users/mikem/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
import { createServer } from 'vite';
import { Chess } from './src/chess.ts';

const server = await createServer({
  define: { 'import.meta.env.VITE_SUPABASE_DEV_URL': '""', 'import.meta.env.VITE_SUPABASE_DEV_PUBLISHABLE_KEY': '""' },
  server: { host: '127.0.0.1', port: 0, open: false },
});
let browser;
const labels = { q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight' };
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const url = server.resolvedUrls.local[0];
  async function scenario({ mode = 'standard', color = 'w', choice = 'q', capture = false, drag = false, premove = false, mobile = false, keyboard = false }) {
    const id = crypto.randomUUID();
    const fen = premove ? '7k/P6p/8/8/8/8/8/7K b - - 0 1'
      : capture ? '1r5k/P7/8/8/8/8/8/7K w - - 0 1'
      : color === 'w' ? '7k/P7/8/8/8/8/8/7K w - - 0 1'
      : '7k/8/8/8/8/8/p7/7K b - - 0 1';
    const game = new Chess(fen + (mode === 'freestyle' ? ' chess960' : ''));
    const pgn = game.pgn();
    const page = await browser.newPage({ viewport: { width: mobile ? 390 : 1440, height: 1100 }, hasTouch: mobile, isMobile: mobile });
    page.setDefaultTimeout(15000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    try {
      await page.addInitScript(({ id, pgn, color }) => {
        localStorage.setItem('neon-knights-sound-v1', 'off');
        localStorage.setItem('neon-knights-music-v1', 'off');
        localStorage.setItem('arcade-gambit-storage-notice-v1', 'acknowledged');
        localStorage.setItem('neon-knights-saved-match-v1', JSON.stringify({ id, bossIndex: color === 'w' ? 1 : 0, pgn, tauntIndex: 0 }));
        const original = window.setTimeout;
        window.setTimeout = (fn, delay, ...args) => original(fn, delay >= 520 && delay <= 940 ? 1800 : delay, ...args);
      }, { id, pgn, color });
      await page.goto(`${url}#battle`);
      await page.waitForFunction(id => JSON.parse(localStorage.getItem('arcade-chess-history-v1') ?? '[]').some(match => match.id === id), id, { timeout: 15000 });
      const from = color === 'w' ? 'a7' : 'a2';
      const to = capture ? 'b8' : color === 'w' ? 'a8' : 'a1';
      const source = page.locator(`[data-square="${from}"]`);
      const target = page.locator(`[data-square="${to}"]`);
      async function movePawn() {
        if (keyboard) {
          await source.focus(); await page.keyboard.press('Enter');
          await target.focus(); await page.keyboard.press('Enter');
          return;
        }
        if (mobile) { await source.tap(); await target.tap(); return; }
        if (!drag) { await source.click(); await target.click(); return; }
        await target.scrollIntoViewIfNeeded();
        const a = await source.boundingBox(), b = await target.boundingBox();
        await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
        await page.mouse.down();
        await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
        await page.mouse.up();
      }
      await movePawn();
      if (premove) await page.locator('.square-premove-to').waitFor();
      const dialog = page.getByRole('menu', { name: 'Promote your pawn' });
      await dialog.waitFor();
      assert.equal(await dialog.getByRole('menuitem', { name: /^Promote to / }).count(), 4);
      assert.equal(await page.locator('.modal-backdrop').count(), 0, 'promotion must not cover the board with a backdrop');
      assert.equal(await page.locator(':focus').getAttribute('aria-label'), 'Promote to Queen');
      const menuBox = await dialog.boundingBox();
      const destinationBox = await target.boundingBox();
      assert(menuBox.width <= 200, 'promotion dropdown should remain compact');
      assert(menuBox.x < destinationBox.x + destinationBox.width && menuBox.x + menuBox.width > destinationBox.x,
        'dropdown should be next to the promotion destination');
      assert(await dialog.locator('.promotion-artwork').evaluateAll(previews => previews.every(preview => {
        const frame = preview.getBoundingClientRect(), piece = preview.querySelector('img').getBoundingClientRect();
        return piece.x >= frame.x && piece.y >= frame.y && piece.right <= frame.right && piece.bottom <= frame.bottom;
      })), 'piece previews must stay inside their own choice buttons');
      const before = await page.evaluate(id => JSON.parse(localStorage.getItem('arcade-chess-history-v1')).find(match => match.id === id), id);
      assert(!before.pgn.includes('='), 'promotion must not commit before the player chooses');
      if (keyboard) {
        assert.equal(await page.locator(':focus').getAttribute('aria-label'), 'Promote to Queen');
        await page.keyboard.press('ArrowUp');
        assert.equal(await page.locator(':focus').innerText(), 'Cancel');
        await page.keyboard.press('ArrowDown');
        assert.equal(await page.locator(':focus').getAttribute('aria-label'), 'Promote to Queen');
        await page.keyboard.press('Escape');
        assert.equal(await dialog.count(), 0);
        assert.equal(await page.locator(':focus').getAttribute('data-square'), to, 'Escape restores focus to the board');
        assert.equal((await page.evaluate(id => JSON.parse(localStorage.getItem('arcade-chess-history-v1')).find(match => match.id === id), id)).pgn, before.pgn);
        await movePawn(); await dialog.waitFor();
        await page.locator('.board-files-top').click();
        assert.equal(await dialog.count(), 0, 'clicking outside dismisses the dropdown');
        await movePawn(); await dialog.waitFor();
      }
      if (mobile) {
        const box = await dialog.boundingBox(); assert(box.x >= 0 && box.x + box.width <= 390);
        await dialog.screenshot({ path: '.tmp/promotion-mobile.png' });
      }
      if (choice === 'q') await page.keyboard.press('Enter');
      else await dialog.getByRole('menuitem', { name: `Promote to ${labels[choice]}`, exact: true }).click();
      await page.waitForFunction(({ id, choice }) => JSON.parse(localStorage.getItem('arcade-chess-history-v1')).find(match => match.id === id)?.pgn.includes(`=${choice.toUpperCase()}`), { id, choice });
      const match = await page.evaluate(id => JSON.parse(localStorage.getItem('arcade-chess-history-v1')).find(match => match.id === id), id);
      const restored = new Chess(); restored.loadPgn(match.pgn);
      const promotion = restored.history({ verbose: true }).find(move => move.promotion);
      assert.equal(promotion.promotion, choice);
      assert.equal(promotion.to, to);
      assert.equal(promotion.color, color);
      if (capture) assert.equal(promotion.captured, 'r');
      assert.equal(await dialog.count(), 0);
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  }
  for (const mode of ['standard', 'freestyle']) for (const color of ['w', 'b']) for (const choice of ['q', 'r', 'b', 'n']) {
    await scenario({ mode, color, choice, keyboard: mode === 'standard' && color === 'w' && choice === 'q' });
  }
  await scenario({ mode: 'freestyle', choice: 'n', capture: true, drag: true });
  await scenario({ mode: 'standard', choice: 'r', mobile: true });
  for (const mode of ['standard', 'freestyle']) await scenario({ mode, choice: 'n', premove: true });
  console.log('PASS compact promotion dropdown, Queen default/Enter, all pieces/colors/modes, deferred commit, keyboard arrows/cancel, capture, drag, mobile, premove, archived PGN, no browser errors');
} finally { await browser?.close(); await server.close(); }
