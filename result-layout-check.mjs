import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'file:///C:/Users/mikem/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
const server = await createServer({server:{host:'127.0.0.1',port:0}});
let browser;
try {
 await server.listen(); browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage();
 await page.addInitScript(()=>{
 localStorage.setItem('arcade-gambit-storage-notice-v1','acknowledged');
 localStorage.setItem('neon-knights-sound-v1','off'); localStorage.setItem('neon-knights-music-v1','off');
 localStorage.setItem('arcade-chess-history-v1',JSON.stringify(['win','loss','draw'].map(result=>({id:result,startedAt:new Date().toISOString(),updatedAt:new Date().toISOString(),bossIndex:0,opponent:'Blunder Benny',elo:250,color:'w',pgn:'1. f3 e5 2. g4 Qh4#',result,reason:'Checkmate'}))));
 });
 for(const [width,height] of [[1440,900],[1366,768],[1024,600],[390,844]]) {
 await page.setViewportSize({width,height});
 for(const result of ['win','loss','draw']) {
 await page.goto(server.resolvedUrls.local[0]+'#result/'+result); await page.locator('.match-result').waitFor();
 const layout = await page.evaluate(()=>({height:document.documentElement.scrollHeight, viewport:innerHeight, bottom:document.querySelector('.match-result').getBoundingClientRect().bottom,footer:document.querySelector('footer').getBoundingClientRect().bottom, width:document.documentElement.scrollWidth}));
 assert.equal(layout.height, height, `${width}x${height} ${result}: vertical scrolling`);
 assert.equal(layout.width, width, `${width}x${height} ${result}: horizontal scrolling`);
 assert(await page.locator('.result-side-panel .review-controls button').count() === 2);
 console.log('PASS', width, height, result);
 }
 }
 await page.setViewportSize({width:1366,height:768});
 await page.goto(server.resolvedUrls.local[0]+'#result/win');
 await page.locator('.match-result').waitFor();
 await page.screenshot({path:'result-layout-check.png',fullPage:true});
} finally {await browser?.close();await server.close();}
