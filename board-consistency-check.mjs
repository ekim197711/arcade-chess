import assert from 'node:assert/strict';
import {writeFile,mkdir,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer} from 'vite';
import {chromium} from 'file:///C:/Users/mikem/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
await mkdir('.tmp',{recursive:true});
const source=JSON.parse(await readFile('src/gambits.json','utf8')).find(g=>g.name==="King's Gambit");source.scenarios=source.scenarios.slice(0,1);
const promotion={id:'promotion-fixture',name:"Queen's Gambit",boss:0,scenarios:[{name:'Promotion practice',eco:'A00',pgn:'[SetUp "1"]\n[FEN "7k/P7/8/3p4/4P3/8/8/7K b - - 0 1"]\n\n1... dxe4'}]};
await writeFile('.tmp/shared-board-catalog.ts','export default '+JSON.stringify([source,promotion]));
await writeFile('.tmp/shared-board-fixture.html','<html><body><div id="root"></div><script type="module" src="/./.tmp/shared-board-fixture.tsx"></script></body></html>');
await writeFile('.tmp/shared-board-fixture.tsx',`import React from 'react';import {createRoot} from 'react-dom/client';import GambitTraining from '../src/GambitTraining';import '../src/styles.css';import '../src/light.css';import '../src/amiga.css';import '../src/ui-colors.css';import '../src/movementHighlights.css';import '../src/freestyle.css';createRoot(document.getElementById('root')!).render(<div className="app-shell app-shell-freestyle"><GambitTraining accountId="shared-board-test" theme="granite-3d" light="#e4d7bc" dark="#745c44" onClose={()=>{}}/></div>);`);
const server=await createServer({resolve:{alias:[{find:'./gambits.json',replacement:resolve('.tmp/shared-board-catalog.ts')}]},server:{host:'127.0.0.1',port:0,open:false,watch:null}});let browser;
try{
 await server.listen();browser=await chromium.launch({channel:'msedge',headless:true});const url=server.resolvedUrls.local[0]+'.tmp/shared-board-fixture.html';
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);await page.locator('.gambit-catalog button').filter({has:page.getByText("King's Gambit",{exact:true})}).click();await page.getByRole('button',{name:'Play',exact:true}).click();
 const sq=name=>page.locator(`.gambit-square[data-square="${name}"]`);
 await sq('e2').click();await sq('e4').click();assert.equal(await sq('f2').isDisabled(),false,'opponent turn stays interactive');
 await sq('g1').click();await sq('f3').click();await page.getByRole('button',{name:'Cancel premove',exact:true}).waitFor();await page.keyboard.press('Escape');assert.equal(await page.locator('.premove-cancel').count(),0);
 await sq('f2').click();await sq('f4').click();await sq('g1').click();await sq('f3').click();await page.getByRole('button',{name:'Cancel all 2 premoves',exact:true}).waitFor();
 await page.getByRole('heading',{name:'Gambit played. What comes next?',exact:true}).waitFor({timeout:35000});assert.match(await page.locator('.gambit-history').innerText(),/e4 e5 f4 exf4/);
 await page.getByRole('button',{name:'Play on against Stockfish',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-square="f3"]')?.getAttribute('aria-label')?.includes('white n'),{},{timeout:35000});
 assert.deepEqual(errors,[]);await page.close();
 for(const [piece,name] of [['q','Queen'],['r','Rook'],['b','Bishop'],['n','Knight']]){
  const tab=await browser.newPage({viewport:{width:390,height:844}});await tab.goto(url);await tab.locator('.gambit-catalog button').filter({has:tab.getByText("Queen's Gambit",{exact:true})}).click();await tab.getByRole('button',{name:'Play',exact:true}).click();await tab.getByRole('button',{name:'Play on against Stockfish',exact:true}).waitFor({timeout:35000});await tab.getByRole('button',{name:'Play on against Stockfish',exact:true}).click();
  await tab.locator('[data-square="a7"]').click();await tab.locator('[data-square="a8"]').click();const popup=tab.getByRole('menu',{name:'Promote your pawn',exact:true});await popup.waitFor();
  assert.equal(await popup.getByRole('menuitem').count(),5);assert.equal(await popup.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(48, 23, 79)','portal inherits cabinet theme');const box=await popup.boundingBox();assert(box.x>=0&&box.x+box.width<=390);
  await popup.getByRole('menuitem',{name:`Promote to ${name}`,exact:true}).click();await tab.waitForFunction(piece=>document.querySelector('[data-square="a8"]')?.getAttribute('aria-label')?.includes('white '+piece),piece);assert.equal(await popup.count(),0);await tab.close();
 }
 console.log('PASS trainer premove queue/cancellation/execution, continuation queue, all four shared promotion choices, mobile placement and themed portal');
}finally{await browser?.close();await server.close();}
