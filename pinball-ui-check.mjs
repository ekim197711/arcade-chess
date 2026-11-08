import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'file:///C:/Users/mikem/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
const server=await createServer({define:{'import.meta.env.VITE_SUPABASE_DEV_URL':JSON.stringify('https://pinball-check.supabase.co'),'import.meta.env.VITE_SUPABASE_DEV_PUBLISHABLE_KEY':JSON.stringify('sb_publishable_test')},server:{host:'127.0.0.1',port:0,open:false,watch:null}});let browser;
try{
 await server.listen();browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://pinball-check.supabase.co/**',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({entries:[{rank:1,score:9000,name:'Queen Bee'},{rank:2,score:8000,name:'Rook Star'}],personal:null})}));
 await page.addInitScript(()=>{localStorage.setItem('arcade-gambit-storage-notice-v1','acknowledged');localStorage.setItem('neon-knights-sound-v1','off');localStorage.setItem('neon-knights-music-v1','off');});
 const url=`http://127.0.0.1:${server.httpServer.address().port}/`;
 await page.goto(url);await page.getByRole('button',{name:'Chess Pinball',exact:true}).waitFor();
 const buttons=page.locator('.home-play-modes .game-start-button');assert((await buttons.count())>=14);
 for(const button of await buttons.all())assert(await button.isDisabled(),await button.textContent());
 await page.getByRole('button',{name:/Insert one coin/}).click();
 for(const button of await buttons.all())assert(await button.isEnabled(),await button.textContent());
 await page.getByRole('button',{name:'Chess Pinball',exact:true}).click();await page.locator('canvas').waitFor();
 await page.getByText('Queen Bee',{exact:false}).waitFor();
 for(const viewport of [{width:1440,height:1000},{width:1366,height:768},{width:390,height:844}]){
   await page.setViewportSize(viewport);await page.screenshot({path:`.tmp/pinball-${viewport.width}.png`,fullPage:true});
   const layout=await page.evaluate(()=>{const b=document.querySelector('canvas').getBoundingClientRect();return{width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,boardBottom:b.bottom};});
   assert(layout.width<=viewport.width+1,JSON.stringify(layout));assert(layout.boardBottom<=viewport.height,JSON.stringify(layout));if(viewport.width>900)assert(layout.height<=viewport.height+1,JSON.stringify(layout));
 }
 await page.setViewportSize({width:1440,height:1000});await page.locator('canvas').focus();await page.keyboard.press('Space');await page.waitForFunction(()=>document.querySelector('canvas').dataset.phase==='playing');
 await page.keyboard.down('ShiftLeft');await page.waitForFunction(()=>document.querySelector('canvas').dataset.left==='true');assert.equal(await page.locator('canvas').getAttribute('data-right'),'false');await page.keyboard.up('ShiftLeft');
 await page.keyboard.down('ShiftRight');await page.waitForFunction(()=>document.querySelector('canvas').dataset.right==='true');await page.keyboard.up('ShiftRight');
 await page.keyboard.press('p');await page.getByRole('heading',{name:'PAUSED',exact:true}).waitFor();await page.getByRole('button',{name:'Resume pinball'}).click();
 await page.waitForFunction(()=>Number(document.querySelector('.pinball-score').textContent.replaceAll(',',''))>0);
 await page.getByRole('button',{name:'Back to arcade',exact:true}).click();
 const best=await page.evaluate(()=>JSON.parse(localStorage.getItem('arcade-pinball-v1:guest')));assert(best>0);
 await page.goto(url+'#pinball');await page.locator('canvas').waitFor();assert((await page.locator('.pinball-controls').textContent()).includes(best.toLocaleString()));
 await page.evaluate(()=>localStorage.setItem('arcade-chess-credit-count-v1','0'));
 for(const route of ['pinball','starship','astroid','gambits','online/new/5/standard']){await page.goto(url+'#'+route);await page.reload();await page.getByRole('region',{name:'Coin required'}).waitFor();assert.equal(await page.locator('canvas').count(),0);}
 assert.deepEqual(errors,[]);console.log('PASS all 14 home Play buttons require coins, direct-entry gates, leaderboard, independent Shift controls, launch/pause, saved high score and responsive layouts.');
}finally{await browser?.close();await server.close();}
