import assert from 'node:assert/strict';
import { chromium } from 'file:///C:/Users/mikem/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
import { createServer, preview } from 'vite';

const production = process.argv.includes('--production');
const server = production
  ? await preview({ preview: { host: '127.0.0.1', port: 0, open: false } })
  : await createServer({ server: { host: '127.0.0.1', port: 0, open: false } });
let browser;
try {
  if (!production) await server.listen();
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(15000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('neon-knights-sound-v1', 'on');
    localStorage.setItem('neon-knights-music-v1', 'off');
    localStorage.setItem('neon-knights-sfx-volume-v1', '40');
    globalThis.coinPlays = [];
    globalThis.coinCompletions = [];
    globalThis.coinOscillators = 0;
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (this.src.includes('/animations/coin-insert/')) globalThis.coinPlays.push({ src: this.src, volume: this.volume, muted: this.muted });
      return play.call(this);
    };
    const oscillator = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function () { globalThis.coinOscillators++; return oscillator.call(this); };
    document.addEventListener('coin-insert-complete', event => globalThis.coinCompletions.push(event.detail.variant));
  });
  const url = server.resolvedUrls.local[0];
  await page.goto(url);
  const button = page.getByRole('button', { name: /^Insert one coin/ });
  await button.waitFor();
  await page.waitForFunction(() => document.querySelector('coin-insert')?.shadowRoot?.querySelector('svg'));
  assert.equal(await page.locator('coin-insert').count(), 1, 'one custom element after Strict Mode setup');
  let credits = 0;
  async function insert(variant, random) {
    await page.evaluate(value => { Math.random = () => value; }, random);
    await button.click();
    credits++;
    await page.waitForFunction(expected => Number(localStorage.getItem('arcade-chess-credit-count-v1')) === expected, credits);
    const actual = await page.locator('coin-insert').evaluate(element => ({ variant: element.variant, src: element.audio.src, volume: element.audio.volume, muted: element.audio.muted, hidden: element.parentElement.hidden }));
    assert.equal(actual.variant, variant);
    assert(new URL(actual.src).pathname.endsWith(`/coin-insert/${variant}.wav`));
    assert.equal(actual.hidden, false);
    assert(Math.abs(actual.volume - .22) < .001);
    return actual;
  }
  async function finish() { await page.waitForFunction(() => document.querySelector('.coin-insert-stage').hidden); }
  for (const [variant, random] of [['bounce', .01], ['flip', .5], ['rocket', .99]]) {
    const actual = await insert(variant, random);
    assert.equal(actual.muted, false);
    if (variant === 'bounce') await page.locator('.arcade-screen').screenshot({ path: '.tmp/coin-insert-desktop.png' });
    await finish();
  }
  assert.deepEqual(await page.evaluate(() => globalThis.coinCompletions), ['bounce', 'flip', 'rocket']);
  assert.equal(await page.evaluate(() => globalThis.coinOscillators), 0, 'matching WAV replaces the old synthetic coin and generic UI sounds');

  // A second click interrupts the old run without dropping a credit or hiding the new run.
  await page.evaluate(() => { globalThis.coinCompletions = []; });
  await insert('bounce', .01);
  await insert('flip', .5);
  await finish();
  assert.deepEqual(await page.evaluate(() => globalThis.coinCompletions), ['flip']);

  await page.getByRole('button', { name: 'Mute sound effects', exact: true }).click();
  assert.equal((await insert('rocket', .99)).muted, true);
  await finish();
  await page.getByRole('button', { name: 'Enable sound effects', exact: true }).click();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await insert('flip', .5);
  const reduced = await page.locator('coin-insert').evaluate(element => {
    element.draw(.1);
    const svg = element.shadowRoot.querySelector('svg').getBoundingClientRect();
    return { rotation: element.shadowRoot.getElementById('coin').getAttribute('transform'), burst: element.shadowRoot.getElementById('burst').style.opacity, left: svg.left, right: svg.right, width: svg.width };
  });
  assert(reduced.rotation.includes('rotate(0)'));
  assert.equal(reduced.burst, '0');
  assert(reduced.width > 100 && reduced.left >= 0 && reduced.right <= 390);
  await page.locator('.arcade-screen').screenshot({ path: '.tmp/coin-insert-mobile.png' });
  await finish();

  await insert('bounce', .01);
  await page.locator('coin-insert').evaluate(element => { globalThis.previousCoin = element; });
  await page.getByRole('button', { name: 'Standard', exact: true }).click();
  credits--;
  await page.waitForURL('**/#roster');
  assert.equal(await page.locator('coin-insert').count(), 0);
  assert(await page.evaluate(() => globalThis.previousCoin.audio.paused && !globalThis.previousCoin.isConnected));
  await page.goto(`${url}#home`);
  await insert('rocket', .99);
  await finish();

  // Browser audio rejection must not block animation or credits.
  await page.evaluate(() => {
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (this.src.includes('/animations/coin-insert/')) return Promise.reject(new DOMException('Test blocked audio', 'NotAllowedError'));
      return play.call(this);
    };
  });
  await insert('bounce', .01);
  await finish();

  await page.evaluate(() => localStorage.setItem('arcade-chess-credit-count-v1', '100'));
  await page.reload();
  await page.waitForFunction(() => !document.querySelector('.arcade-coin-button').disabled);
  await button.click();
  assert.equal(await page.evaluate(() => localStorage.getItem('arcade-chess-credit-count-v1')), '99');
  assert.equal(await page.locator('.arcade-credit-hint').textContent(), 'Maximum credits achieved!');
  assert.equal(await page.locator('.arcade-toast').count(), 0);
  assert(await page.locator('.coin-insert-stage').evaluate(element => element.hidden));
  assert.equal(await page.evaluate(() => globalThis.coinPlays.length), 0);
  assert.deepEqual(errors, []);
  console.log(`PASS ${production ? 'production' : 'dev'}: all three random variants/matching audio, volume/mute, one credit per click, rapid replay, reduced motion, mobile, navigation cleanup, audio rejection, maximum credits`);
} finally {
  await browser?.close();
  if (production) await new Promise(resolve => server.httpServer.close(resolve)); else await server.close();
}
