import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'file:///C:/Users/mikem/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
const server=await createServer({define:{'import.meta.env.VITE_SUPABASE_DEV_URL':'""','import.meta.env.VITE_SUPABASE_DEV_PUBLISHABLE_KEY':'""'},server:{host:'127.0.0.1',port:0,open:false}});
const key='arcade-chess-review-preferences-v1';
let browser;
try{
 await server.listen();browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{
  if(sessionStorage.getItem('review-size-fixture'))return;sessionStorage.setItem('review-size-fixture','yes');
  localStorage.setItem('arcade-gambit-storage-notice-v1','acknowledged');localStorage.setItem('neon-knights-sound-v1','off');localStorage.setItem('neon-knights-music-v1','off');
  localStorage.setItem('arcade-chess-board-size-v1','777');
  localStorage.setItem('arcade-chess-review-preferences-v1',JSON.stringify({moveSeconds:10,specialMoveSeconds:2,theme:'classic-2d',showCoordinates:true,eventMode:'continue'}));
  localStorage.setItem('arcade-chess-history-v1',JSON.stringify(['w','b'].map(color=>({id:'size-'+color,startedAt:new Date().toISOString(),updatedAt:new Date().toISOString(),bossIndex:0,opponent:'Test boss',elo:100,color,pgn:'1. f3 e5 2. g4 Qh4#',result:color==='w'?'loss':'win',reason:'Checkmate'}))));
 });
 const url=server.resolvedUrls.local[0];
 await page.goto(url+'#review/size-w');
 const slider=page.getByRole('slider',{name:'Review board size',exact:true}),handle=page.getByRole('button',{name:'Resize chessboard',exact:true}),frame=page.locator('.review-board-frame');
 const saved=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
 const width=async()=>Math.round((await frame.boundingBox()).width);
 await slider.waitFor();await page.evaluate(()=>document.fonts.ready);
 assert.equal((await saved()).boardWidth,null,'old preferences migrate to auto-fit');
 const autoWidth=await width();assert(autoWidth>300);
 await slider.focus();await slider.press('Home');await slider.press('ArrowRight');
 await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).boardWidth===250,key);
 assert.equal(await width(),250);
 await page.getByRole('button',{name:'Next',exact:true}).click();
 assert.equal(await page.getByRole('slider',{name:'Replay position',exact:true}).inputValue(),'1');
 await handle.focus();await handle.press('ArrowRight');
 await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).boardWidth===260,key);
 assert.equal(await width(),260);
 assert.equal(await page.getByRole('slider',{name:'Replay position',exact:true}).inputValue(),'1','resizing preserves the selected move');
 await handle.press('Shift+ArrowRight');assert.equal(await width(),310);
 const grip=await handle.boundingBox();await page.mouse.move(grip.x+grip.width/2,grip.y+grip.height/2);await page.mouse.down();await page.mouse.move(grip.x+grip.width/2+40,grip.y+grip.height/2,{steps:5});await page.mouse.up();
 const dragged=await width();assert(dragged>310,'dragging enlarges the board');assert.equal((await saved()).boardWidth,dragged);
 await page.reload();await slider.waitFor();assert.equal(await width(),dragged,'reload restores the saved width');
 let preferences=await saved();assert.equal(preferences.moveSeconds,10);assert.equal(preferences.specialMoveSeconds,2);assert.equal(preferences.showCoordinates,true);assert.equal(preferences.eventMode,'continue');
 assert.equal(await page.evaluate(()=>localStorage.getItem('arcade-chess-board-size-v1')),'777','battle board preference stays separate');
 await page.goto(url+'#review/size-b');await slider.waitFor();assert.equal(await width(),dragged,'another game and opposite orientation share the review setting');
 for(const viewport of [{width:390,height:844},{width:320,height:640}]){
  await page.setViewportSize(viewport);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const board=await page.getByLabel('Replay chessboard',{exact:true}).boundingBox();
  assert(Math.abs(board.width-board.height)<1);assert(board.x>=0&&board.x+board.width<=viewport.width);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.equal((await saved()).boardWidth,dragged,'narrow screens cap display without overwriting the preference');
 }
 await page.screenshot({path:'.tmp/review-board-size-mobile.png',fullPage:true});
 await page.setViewportSize({width:1920,height:1080});
 await page.getByRole('button',{name:'Auto-fit board',exact:true}).click();assert.equal((await saved()).boardWidth,null);assert.equal(await width(),autoWidth);
 await page.reload();await slider.waitFor();assert.equal((await saved()).boardWidth,null);
 for(const invalid of [-5,5000,'500']){
  await page.evaluate(({key,invalid})=>{const value=JSON.parse(localStorage.getItem(key));value.boardWidth=invalid;localStorage.setItem(key,JSON.stringify(value));},{key,invalid});
  await page.reload();await slider.waitFor();assert.equal((await saved()).boardWidth,null,'invalid saved sizes fall back to auto-fit');
 }
 await page.evaluate(()=>{const write=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='arcade-chess-review-preferences-v1')throw new DOMException('Test storage failure','QuotaExceededError');return write.call(this,key,value)}});
 await slider.focus();await slider.press('Home');await slider.press('ArrowRight');assert.equal(await width(),250);
 await page.getByRole('alert').filter({hasText:'Review preferences could not be saved'}).waitFor();
 await page.screenshot({path:'.tmp/review-board-size-desktop.png',fullPage:true});assert.deepEqual(errors,[]);await page.close();
 console.log('PASS review board sizing: slider, drag, keyboard, selected-move preservation, reload/other-game persistence, auto-fit reset, legacy/invalid preferences, battle-size isolation, storage failure and narrow screens.');
}finally{await browser?.close();await server.close();}
