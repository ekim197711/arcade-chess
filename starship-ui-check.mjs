import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'file:///C:/Users/mikem/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
import { REPAIRS } from './src/starshipRules.ts';
import { Chess } from 'chess.js';
const server = await createServer({server:{host:'127.0.0.1',port:0,open:false,watch:null}});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({channel:'chrome', headless:true});
  const page = await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    localStorage.setItem('arcade-gambit-storage-notice-v1','acknowledged');
    localStorage.setItem('arcade-chess-credit-count-v1','1');
    localStorage.setItem('neon-knights-music-v1','off');
    localStorage.setItem('neon-knights-sound-v1','off');
  });
  const url=`http://127.0.0.1:${server.httpServer.address().port}/#starship`;
  await page.goto(url);
  await page.getByRole('button',{name:'Help Nova · Start repairs'}).click();
  await page.getByRole('button',{name:'Hint',exact:true}).click();
  assert((await page.locator('.rescue-hint:visible').textContent()).includes(REPAIRS[0].puzzle.solutions[0].from));
  await page.getByRole('button',{name:'Show mating move'}).click();
  assert((await page.locator('.rescue-hint:visible').textContent()).includes(REPAIRS[0].puzzle.solutions[0].san));
  const board=new Chess(REPAIRS[0].puzzle.fen);
  const wrong=board.moves({verbose:true}).find(m=>{const t=new Chess(board.fen());t.move(m);return !t.isCheckmate();});
  await page.locator(`[data-square="${wrong.from}"]`).click();
  await page.locator(`[data-square="${wrong.to}"]`).click();
  assert((await page.locator('.rescue-feedback').textContent()).includes('try another check'));
  for (let i=0;i<6;i++) {
    const solution=REPAIRS[i].puzzle.solutions[0];
    await page.locator(`[data-square="${solution.from}"]`).click();
    await page.locator(`[data-square="${solution.to}"]`).click();
    await page.getByRole('button',{name:i===5?'Return to ship':'Next repair',exact:true}).waitFor();
    const save=await page.evaluate(()=>JSON.parse(localStorage.getItem('arcade-starship-v1:guest')));
    assert.equal(save.repaired,i+1);
    if(i===0) {
      await page.reload();
      await page.getByRole('heading',{name:'Life support',exact:true}).waitFor();
      for (const viewport of [{width:1440,height:1000},{width:1366,height:768},{width:390,height:844}]) {
        await page.setViewportSize(viewport);
        await page.screenshot({path:`.tmp/starship-${viewport.width}.png`,fullPage:true});
        const layout=await page.evaluate(()=>{const b=document.querySelector('.rescue-board').getBoundingClientRect();return {width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,board:{x:b.x,y:b.y,right:b.right,bottom:b.bottom}};});
        assert(layout.scrollWidth<=viewport.width+1,JSON.stringify(layout));
        assert(layout.board.bottom<=viewport.height+1,JSON.stringify(layout));
        if(viewport.width>900) assert(layout.scrollHeight<=viewport.height+1,JSON.stringify(layout));
      }
      await page.setViewportSize({width:1440,height:1000});
    } else await page.getByRole('button',{name:i===5?'Return to ship':'Next repair',exact:true}).click();
  }
  await page.reload();
  await page.getByRole('button',{name:'Launch starship',exact:true}).click();
  await page.getByRole('heading',{name:'Next stop: home.'}).waitFor();
  await page.reload();
  await page.getByRole('heading',{name:'Next stop: home.'}).waitFor();
  await page.getByRole('button',{name:'Replay repair puzzles'}).click();
  await page.getByRole('button',{name:'Hint',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('arcade-starship-v1:guest')).launched),true);
  assert.deepEqual(errors,[]);
  console.log('PASS: hints, mistakes, six repairs, reload/resume, launch persistence, replay and three responsive layouts.');
} finally { await browser?.close(); await server.close(); }
