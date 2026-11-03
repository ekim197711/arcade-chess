import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'file:///C:/Users/mikem/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
const server=await createServer({server:{host:'127.0.0.1',port:0,open:false,watch:null}});let browser;
try{
 await server.listen();browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{localStorage.setItem('neon-knights-sound-v1','off');localStorage.setItem('neon-knights-music-v1','off');localStorage.setItem('arcade-gambit-storage-notice-v1','acknowledged');localStorage.setItem('arcade-gambit-analytics-consent-v1','denied');localStorage.setItem('neon-knights-saved-match-v1',JSON.stringify({bossIndex:1,pgn:'1. e4 e5',tauntIndex:0}));localStorage.setItem('arcade-chess-history-v1',JSON.stringify([{id:'highlight-test',startedAt:new Date().toISOString(),updatedAt:new Date().toISOString(),bossIndex:1,opponent:'Highlight boss',elo:100,color:'w',pgn:'1. e4 e5',result:'draw',reason:'Draw'}]));});
 async function filled(selector){await page.locator(selector).first().waitFor();assert.equal(await page.locator(selector).count(),2);for(const square of await page.locator(selector).all()){const css=await square.evaluate(el=>({shadow:getComputedStyle(el).boxShadow,bg:getComputedStyle(el).backgroundColor,border:getComputedStyle(el).borderWidth}));assert.equal(css.shadow,'none');assert.notEqual(css.bg,'rgba(0, 0, 0, 0)');assert.equal(css.border,'0px');}}
 await page.goto(server.resolvedUrls.local[0]+'#battle');await filled('.square-last');
 await page.locator('[data-square="g1"]').click();assert.equal(await page.locator('.square-selected').evaluate(el=>getComputedStyle(el).boxShadow),'none');assert.equal(await page.locator('.square-target').first().evaluate(el=>getComputedStyle(el,'::before').display),'none');
 await page.goto(server.resolvedUrls.local[0]+'#review/highlight-test');await page.getByRole('button',{name:'Next',exact:true}).click();await filled('.review-highlight');await page.screenshot({path:'.tmp/review-filled-highlights.png',fullPage:true});
 await page.goto(server.resolvedUrls.local[0]+'#result/highlight-test');await filled('.review-highlight');assert.deepEqual(errors,[]);
 console.log('PASS full-square backgrounds without movement borders/shadows on battle, selection, destinations, review and final-position boards');
}finally{await browser?.close();await server.close();}
