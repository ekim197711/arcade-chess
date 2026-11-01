import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'file:///C:/Users/mikem/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
const server=await createServer({server:{host:'127.0.0.1',port:0,open:false,watch:null}});let browser;
try {
 const {explainNotation,NOTATION_PATTERN}=await server.ssrLoadModule('/src/notationGlossary.ts');
 for(const [notation,expected] of [['Nf3',/knight/],['f5',/file f.*rank 5/],['N...',/knight/],['Nbd2',/starts on file b/],['R1e2',/starts on rank 1/],['Qxf7#',/checkmate/],['O-O-O',/Queenside/],['exd8=Q+',/promote.*queen/],['2...',/Black/]])assert.match(explainNotation(notation),expected);
 assert.deepEqual([..."Play Nf3 from g1 to f3. Then exd5, O-O, e8=Q+ and N...".matchAll(NOTATION_PATTERN)].map(m=>m[0]),['Nf3','g1','f3','exd5','O-O','e8=Q+','N...']);
 await server.listen();browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{localStorage.setItem('neon-knights-sound-v1','off');localStorage.setItem('neon-knights-music-v1','off');localStorage.setItem('arcade-gambit-storage-notice-v1','acknowledged');localStorage.setItem('arcade-gambit-analytics-consent-v1','denied');localStorage.setItem('arcade-chess-history-v1',JSON.stringify([{id:'notation-test',startedAt:new Date().toISOString(),updatedAt:new Date().toISOString(),bossIndex:0,opponent:'Notation boss',elo:100,color:'w',pgn:'1. Nf3 d5 2. d4 Nf6',result:'draw',reason:'Draw'}]));});
 await page.goto(server.resolvedUrls.local[0]+'#gambits');await page.getByRole('searchbox').fill("King's Gambit");await page.locator('.gambit-catalog button').filter({has:page.getByText("King's Gambit",{exact:true})}).click();await page.getByRole('button',{name:'Understood',exact:true}).click();
 const trigger=page.getByRole('button',{name:'Explain e2',exact:true}).first();await trigger.focus();await page.keyboard.press('Enter');const help=page.locator('.chess-notation-help:popover-open');await help.waitFor();assert.match(await help.innerText(),/file e.*rank 2/);await page.keyboard.press('Escape');assert.equal(await help.count(),0);
 await page.goto(server.resolvedUrls.local[0]+'#review/notation-test');await page.getByRole('button',{name:'Next',exact:true}).click();await page.getByRole('button',{name:'Explain Nf3',exact:true}).first().click();await help.waitFor();assert.match(await help.innerText(),/knight.*f3/);await page.getByRole('button',{name:'Close explanation',exact:true}).click();assert.equal(await help.count(),0);
 await page.getByRole('button',{name:'Explain 1.',exact:true}).click();await help.waitFor();assert.match(await help.innerText(),/White/);await page.keyboard.press('Escape');
 assert.equal(await page.locator('button button').count(),0);
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Explain Nf3',exact:true}).first().click();await help.waitFor();const bounds=await help.boundingBox();assert(bounds.x>=0&&bounds.x+bounds.width<=390);await page.screenshot({path:'.tmp/chess-notation-help.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS notation parsing, gambit help, review help, keyboard/escape/close, mobile popover, no nested buttons');
}finally{await browser?.close();await server.close();}
