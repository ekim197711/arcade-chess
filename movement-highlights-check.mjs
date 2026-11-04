import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'file:///C:/Users/mikem/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
const server=await createServer({server:{host:'127.0.0.1',port:0,open:false,watch:null}});let browser;
try{
 await server.listen();browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{localStorage.setItem('neon-knights-sound-v1','off');localStorage.setItem('neon-knights-music-v1','off');localStorage.setItem('arcade-gambit-storage-notice-v1','acknowledged');localStorage.setItem('arcade-gambit-analytics-consent-v1','denied');localStorage.setItem('neon-knights-saved-match-v1',JSON.stringify({bossIndex:1,pgn:'1. e4 e5',tauntIndex:0}));localStorage.setItem('arcade-chess-history-v1',JSON.stringify([{id:'highlight-test',startedAt:new Date().toISOString(),updatedAt:new Date().toISOString(),bossIndex:1,opponent:'Highlight boss',elo:100,color:'w',pgn:'1. e4 e5',result:'draw',reason:'Draw'}]));});
 async function filled(selector){await page.locator(selector).first().waitFor();assert.equal(await page.locator(selector).count(),2);for(const square of await page.locator(selector).all()){const css=await square.evaluate(el=>({shadow:getComputedStyle(el).boxShadow,bg:getComputedStyle(el).backgroundColor,border:getComputedStyle(el).borderWidth}));assert.equal(css.shadow,'none');assert.notEqual(css.bg,'rgba(0, 0, 0, 0)');assert.equal(css.border,'0px');}}
 async function pairedColors(){return page.locator('.chessboard').first().evaluate(board=>{
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d');
  const rgb=selector=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=getComputedStyle(board.querySelector(selector)).backgroundColor;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].slice(0,3);};
  return {from:rgb('.square-last-from'),to:rgb('.square-last-to')};
 });}
 function lighterDestination(pair){const l=rgb=>rgb.reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);const difference=l(pair.to)-l(pair.from);assert(difference>0&&difference<30,'destination is subtly lighter than origin');}
 await page.goto(server.resolvedUrls.local[0]+'#battle');await filled('.square-last');
 const original=await pairedColors();lighterDestination(original);
 const previous=await page.locator('.chessboard').first().evaluate(board=>{const old=board.getAttribute('style');board.style.setProperty('--board-square-light','#f0d9b5');board.style.setProperty('--board-square-dark','#946f48');return old;});
 const warm=await pairedColors();lighterDestination(warm);assert.notDeepEqual(original,warm,'highlights follow the chosen board palette');
 await page.locator('.chessboard').first().evaluate((board,old)=>{if(old===null)board.removeAttribute('style');else board.setAttribute('style',old);},previous);
const targetBefore=await page.locator('[data-square="f3"]').evaluate(el=>getComputedStyle(el).backgroundColor);
 await page.locator('[data-square="g1"]').click();assert.equal(await page.locator('.square-selected').evaluate(el=>getComputedStyle(el).boxShadow),'none');assert.equal(await page.locator('.square-target').first().evaluate(el=>getComputedStyle(el,'::before').display),'block');
 assert.equal(await page.locator('[data-square="f3"]').evaluate(el=>getComputedStyle(el).backgroundColor),targetBefore,'legal destination keeps its square background');assert.equal(await page.locator('.square-target').first().evaluate(el=>getComputedStyle(el,'::before').backgroundColor),'rgba(0, 0, 0, 0)','marker is a hollow donut');
 await page.goto(server.resolvedUrls.local[0]+'#review/highlight-test');await page.getByRole('button',{name:'Next',exact:true}).click();await filled('.review-highlight');lighterDestination(await pairedColors());await page.screenshot({path:'.tmp/review-filled-highlights.png',fullPage:true});
 await page.goto(server.resolvedUrls.local[0]+'#result/highlight-test');await filled('.review-highlight');assert.deepEqual(errors,[]);
 console.log('PASS theme-aware paired backgrounds (darker origin, subtly lighter destination) without movement borders/shadows on battle, selection, destinations, review and final-position boards');
}finally{await browser?.close();await server.close();}
