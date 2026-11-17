import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'file:///C:/Users/mikem/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
const server=await createServer({server:{host:'127.0.0.1',port:0,watch:null}});
let browser;
try {
 await server.listen(); browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({reducedMotion:'reduce'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  localStorage.setItem('arcade-gambit-storage-notice-v1','acknowledged');
  localStorage.setItem('arcade-gambit-analytics-consent-v1','denied');
  localStorage.setItem('neon-knights-music-v1','off');localStorage.setItem('neon-knights-sound-v1','off');
 });
 for(const [width,height] of [[1440,900],[1024,600],[390,844],[320,640]]) {
  await page.setViewportSize({width,height});
  for(const route of ['home','settings','roster','history']) {
   await page.goto(server.resolvedUrls.local[0]+'#'+route,{waitUntil:'domcontentloaded'});
   await page.locator(`.app-shell[data-screen="${route}"]`).waitFor();
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   assert(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight&&document.documentElement.scrollWidth<=innerWidth),`${route} fits ${width}x${height}`);
   if(route==='home'){
    await page.getByRole('heading',{name:'Play chess',exact:true}).waitFor();
    assert(!/Make it count|THE CHESS ARCADE|Real opponents\. Good games/.test(await page.locator('body').innerText()));
    assert(await page.getByRole('button',{name:'Your games',exact:true}).first().isVisible(),'game history stays in navigation on phones');
   }
   if(route==='settings') {
    const buttons=page.locator('.piece-set-options button.piece-theme-option');
    assert.equal(await buttons.count(),width>760?12:6);
    for(const button of await buttons.all()) {
     const images=button.locator('.bishop-preview img');assert.equal(await images.count(),2);
     for(const img of await images.all()) assert.match(await img.getAttribute('src'),/\/(white|black)-bishop\.png$/);
    }
    await page.locator('.bishop-preview img').evaluateAll(async images=>Promise.all(images.map(img=>img.decode())));
   }
   if(width===1440||width===390)await page.screenshot({path:`.tmp/usability-${route}-${width}.png`});
  }
  console.log('PASS simplified pages and bishop previews',width,height);
 }
 assert.deepEqual(errors,[]);
}finally{await browser?.close();await server.close();}
