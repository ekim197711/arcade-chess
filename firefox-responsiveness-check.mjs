import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { createServer } from 'vite';
const { firefox } = await import(process.env.PLAYWRIGHT_FIREFOX_MODULE ?? 'file:///C:/Users/mikem/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs');

const server = await createServer({ define: {
  'import.meta.env.VITE_SUPABASE_DEV_URL': '""',
  'import.meta.env.VITE_SUPABASE_DEV_PUBLISHABLE_KEY': '""',
}, server: { host: '127.0.0.1', port: 0, open: false } });
let browser;
try {
  const { bossThumbnail, BOSS_CHARACTERS, resolveBossCharacter } = await server.ssrLoadModule('/src/bossArtwork.ts');
  const inventory = {};
  for (const folder of await readdir('public/characters', { withFileTypes: true })) if (folder.isDirectory()) {
    inventory[folder.name] = (await readdir(`public/characters/${folder.name}`)).filter(file => file.endsWith('.png')).map(file => file.slice(0,-4));
  }
  for (const boss of BOSS_CHARACTERS) for (const expression of ['focused','taunting']) {
    const url = bossThumbnail(resolveBossCharacter(boss.name, inventory), inventory, expression);
    if (!url) continue;
    const png = await readFile(`public${decodeURIComponent(url)}`);
    assert.equal(png.readUInt32BE(16), 112); assert.equal(png.readUInt32BE(20), 112);
  }
  await server.listen();
  browser = await firefox.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [], fullPortraits = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (/Maximum update depth|Too many re-renders/.test(message.text())) errors.push(message.text()); });
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/characters/')) fullPortraits.push(request.url()); });
  await page.addInitScript(() => {
    localStorage.setItem('neon-knights-sound-v1','off'); localStorage.setItem('neon-knights-music-v1','off');
    localStorage.setItem('arcade-gambit-storage-notice-v1','acknowledged');
  });
  await page.goto(server.resolvedUrls.local[0]);
  await page.locator('.dancing-boss').last().waitFor();
  assert.equal(await page.locator('.dancing-boss').count(),12);
  await page.evaluate(async () => {
    await Promise.all([...document.querySelectorAll('.dancing-boss img')].map(image => image.decode()));
    window.heartbeats = 0;
    window.heartbeat = setInterval(() => window.heartbeats++,50);
  });
  const decodedBytes = await page.locator('.dancing-boss img').evaluateAll(images => images.reduce((sum,image)=>sum+image.naturalWidth*image.naturalHeight*4,0));
  assert.ok(decodedBytes < 1024*1024, 'active parade portraits stay below 1 MB decoded');
  await page.waitForTimeout(1500);
  assert.ok(await page.evaluate(() => window.heartbeats >= 15), 'Firefox event loop remains responsive during animation');
  const route = page.locator('.dancing-boss-route').first();
  const first = await route.locator('button').getAttribute('aria-label');
  await route.locator('button').evaluate(button => button.dispatchEvent(new AnimationEvent('animationiteration',{ animationName:'boss-boogie',bubbles:true })));
  assert.equal(await route.locator('button').getAttribute('aria-label'),first,'child dance events cannot trigger a render storm');
  await route.evaluate(element => element.dispatchEvent(new AnimationEvent('animationiteration',{ animationName:'boss-parade',bubbles:true })));
  await page.waitForFunction(first => document.querySelector('.dancing-boss')?.getAttribute('aria-label') !== first,first);
  assert.equal(await page.locator('.dancing-boss').count(),12,'cycling does not add animation layers');
  await page.getByRole('button',{name:/^Insert one coin/}).click();
  await page.getByRole('button',{name:'Standard',exact:true}).click();
  await page.waitForURL('**/#roster');
  await page.locator('.boss-line').last().waitFor();
  assert.equal(await page.locator('.dancing-boss').count(),0);
  assert.ok(await page.locator('.boss-line img').evaluateAll(images => images.every(image => new URL(image.src).pathname.startsWith('/boss-thumbnails/'))));
  assert.deepEqual(fullPortraits,[],'home and ladder never fetch full-resolution portraits');
  assert.deepEqual(errors,[]);
  console.log(`PASS isolated Firefox: responsive controls/event loop, 12 actors, ${(decodedBytes/1024/1024).toFixed(2)} MB decoded parade images, safe rotation, no full-size home/ladder portraits`);
} finally { await browser?.close(); await server.close(); }
