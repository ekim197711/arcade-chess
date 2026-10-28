import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
const runtime = await import(process.env.PLAYWRIGHT_BOARD_MODULE ?? 'file:///C:/Users/mikem/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs');
const server = await createServer({server:{host:'127.0.0.1',port:0,open:false}});
let browser;
try {
  await mkdir('.tmp',{recursive:true});
  await writeFile('.tmp/board-arrows.html',`<!doctype html><html><body><div id="root"></div><script type="module">
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import {GameReview} from '/src/GameReview.tsx'; import {FinalPositionBoard} from '/src/FinalPositionBoard.tsx';
    import '/src/styles.css'; import '/src/light.css'; import '/src/amiga.css';
    const params=new URLSearchParams(location.search), review=params.get('mode')==='review';
    createRoot(document.getElementById('root')).render(React.createElement(review?GameReview:FinalPositionBoard,{
      pgn:'1. f3 e5 2. g4 Qh4#',color:params.get('color'),theme:'medieval',light:'#e1dcc5',dark:'#5c7958',
      opponent:'Bot',opponentElo:1200,playerName:'Player',onClose(){}
    }));
  </script></body></html>`);
  await server.listen();
  for (const engine of ['chromium','firefox']) {
    browser=await runtime[engine].launch({headless:true,...(engine==='chromium'?{channel:'msedge'}:{})});
    for (const mode of ['review','result']) for (const color of ['w','b']) {
      const page=await browser.newPage({viewport:{width:1440,height:1000}});
      page.setDefaultTimeout(10000);
      const errors=[]; page.on('pageerror',error=>errors.push(error.message));
      try {
        await page.goto(`${server.resolvedUrls.local[0]}.tmp/board-arrows.html?mode=${mode}&color=${color}`);
        const board=page.locator(mode==='review'?'[aria-label="Replay chessboard"]':'[aria-label="Final chessboard"]');
        await board.waitFor();
        const square=name=>board.locator(`[data-square="${name}"]`);
        const draw=async(from,to)=>{
          const a=await square(from).boundingBox(), b=await square(to).boundingBox();
          await page.mouse.move(a.x+a.width/2,a.y+a.height/2); await page.mouse.down({button:'right'});
          await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:4}); await page.mouse.up({button:'right'});
        };
        await draw('g1','f3');
        const arrow=board.locator('.board-thought-arrow');
        assert.equal(await arrow.count(),1,`${engine} ${mode} right-drag creates an arrow`);
        const line=arrow.locator('line');
        assert.equal(await line.getAttribute('x1'),color==='w'?'6.5':'1.5');
        assert.equal(await line.getAttribute('y1'),color==='w'?'7.5':'0.5');
        assert.equal(await line.getAttribute('x2'),color==='w'?'5.5':'2.5');
        assert.equal(await line.getAttribute('y2'),color==='w'?'5.5':'2.5');
        assert.equal(await arrow.evaluate(node=>Number(getComputedStyle(node).opacity)),.45);
        if(engine==='firefox' && mode==='review' && color==='w') await page.screenshot({path:'.tmp/board-arrows-desktop.png'});
        await draw('g1','f3'); assert.equal(await arrow.count(),0);
        await draw('e2','e4'); await draw('d2','d4'); assert.equal(await arrow.count(),2);
        await page.keyboard.press('Escape'); assert.equal(await arrow.count(),0);
        await draw('e2','e4'); await square('a1').click(); assert.equal(await arrow.count(),0);
        await draw('e2','e4'); await board.click({button:'right'}); assert.equal(await arrow.count(),0);
        const source=await square('a1').boundingBox(), bounds=await board.boundingBox();
        await page.mouse.move(source.x+source.width/2,source.y+source.height/2); await page.mouse.down({button:'right'});
        await page.mouse.move(bounds.x-10,bounds.y+20,{steps:4}); await page.mouse.up({button:'right'});
        assert.equal(await arrow.count(),0,'off-board release does not create a stray arrow');
        assert.equal(await board.locator('.board-arrow-preview').count(),0);
        await draw('g1','f3');
        if(mode==='review') {
          await page.getByRole('button',{name:'Next',exact:true}).first().click();
          await page.waitForFunction(()=>!document.querySelector('.board-thought-arrow'));
        } else {
          assert.equal(await board.locator('.final-position-checkmate').count(),1,'annotations do not alter the finished game');
        }
        await page.setViewportSize({width:390,height:844});
        await draw('a1','h8');
        assert.ok(await board.locator('.board-thought-arrow[data-from="a1"][data-to="h8"]').count());
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        assert.deepEqual(errors,[]);
      } finally {await page.close();}
    }
    await browser.close(); browser=undefined;
  }
  console.log('PASS Chromium/Firefox review and result boards: arrows, both orientations, transparency, toggle/clear, off-board release, position changes and responsive layout');
} finally {await browser?.close(); await server.close();}
