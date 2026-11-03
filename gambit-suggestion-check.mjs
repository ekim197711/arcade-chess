import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'vite';
import {chromium} from 'file:///C:/Users/mikem/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
const server=await createServer({server:{host:'127.0.0.1',port:0,open:false,watch:null}});let browser;
try{
 const {suggestGambit}=await server.ssrLoadModule('/src/gambitSuggestion.ts');
 const catalog=JSON.parse(readFileSync('src/gambits.json','utf8'));
 assert.equal(suggestGambit(catalog,[],[]).gambit.id,'queen-s-gambit');
 assert.equal(suggestGambit(catalog,['queen-s-gambit'],[]).gambit.id,'scotch-game-scotch-gambit');
 assert.equal(suggestGambit(catalog,[],['queen-s-gambit:legacy-pgn:w']).gambit.id,'scotch-game-scotch-gambit');
 assert.equal(suggestGambit(catalog,catalog.map(g=>g.id),[]),null);
 const fallback=[{id:'long',name:'Long',scenarios:[{pgn:'1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7#'}]},{id:'short',name:'Short',scenarios:[{pgn:'1. d4 d5 2. c4'},{pgn:'1. d4 d5 2. c4 e6 3. Nc3'}]}];
 assert.equal(suggestGambit(fallback,[],[]).gambit.id,'short');assert.equal(suggestGambit(fallback,[],[]).scenarioIndex,0);
 await server.listen();browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1280,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{localStorage.setItem('neon-knights-sound-v1','off');localStorage.setItem('neon-knights-music-v1','off');localStorage.setItem('arcade-gambit-storage-notice-v1','acknowledged');localStorage.setItem('arcade-gambit-analytics-consent-v1','denied');});
 await page.goto(server.resolvedUrls.local[0]+'#gambits');const card=page.getByRole('region',{name:'Suggested for you',exact:true});await card.waitFor();assert.match(await card.innerText(),/Queen's Gambit/);assert(await card.evaluate(el=>!!(el.compareDocumentPosition(document.querySelector('.gambit-catalog')) & Node.DOCUMENT_POSITION_FOLLOWING)));
 await card.getByRole('button',{name:'Try this gambit',exact:true}).click();await page.getByRole('heading',{name:"The idea behind Queen's Gambit",exact:true}).waitFor();
 await page.getByRole('button',{name:'All gambits',exact:true}).click();assert.match(await card.innerText(),/Queen's Gambit/,'viewing a briefing does not count as played');
 await card.getByRole('button',{name:'Try this gambit',exact:true}).click();await page.getByRole('button',{name:'Understood',exact:true}).click();await page.getByRole('button',{name:'All gambits',exact:true}).click();assert.match(await card.innerText(),/Scotch Game: Scotch Gambit/);
 await page.reload();await card.waitFor();assert.match(await card.innerText(),/Scotch Game: Scotch Gambit/);assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('arcade-gambit-training-played-v1:guest'))),['queen-s-gambit']);
 await page.setViewportSize({width:390,height:1000});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await card.screenshot({path:'.tmp/gambit-suggestion-mobile.png'});
 await page.evaluate(ids=>localStorage.setItem('arcade-gambit-training-played-v1:guest',JSON.stringify(ids)),catalog.map(g=>g.id));await page.reload();await card.waitFor();assert.match(await card.innerText(),/tried every gambit/);assert.equal(await card.getByRole('button').count(),0);assert.deepEqual(errors,[]);
 console.log('PASS easiest unplayed suggestion, legacy completion exclusion, shortest scenario, briefing vs play tracking, persistence, exhausted catalogue and mobile card');
}finally{await browser?.close();await server.close();}
