// Development only. Supply server credentials through the process environment, never arguments.
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { createServer } from 'vite';
import { chromium } from 'file:///C:/Users/mikem/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
const url = process.env.MULTIPLAYER_TEST_URL;
assert.equal(url,'https://nlwtzggjjbacndirlggj.supabase.co','Live test is restricted to development');
const admin = createClient(url,process.env.MULTIPLAYER_TEST_SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const clientKey = process.env.MULTIPLAYER_TEST_PUBLIC_KEY;
const clients=[],users=[],games=[];
let browser,server;
try {
  for (let i=0;i<3;i++) {
    const email=`multiplayer-check-${crypto.randomUUID()}@example.com`,password=crypto.randomUUID()+crypto.randomUUID();
    const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:`Multiplayer test ${i}`}});
    assert.ifError(error);users.push(data.user.id);
    const client=createClient(url,clientKey,{auth:{persistSession:false,autoRefreshToken:false}});
    const signed=await client.auth.signInWithPassword({email,password});assert.ifError(signed.error);
    clients.push({client,session:signed.data.session});
  }
  const call=async(index,body)=>{
    const {data,error}=await clients[index].client.functions.invoke('multiplayer',{body});
    if(error) { let detail='';try{detail=await error.context.text();}catch{} throw new Error(`${error.message}: ${detail}`); }
    assert.ok(!data.error,data.error);return data;
  };
  assert.equal((await call(0,{action:'join',minutes:3})).queued,true);
  let match=(await call(1,{action:'join',minutes:3})).game;games.push(match.id);
  assert.equal(match.is_bot,false);
  const white=match.white_id===users[0]?0:1,black=1-white;
  assert.equal((await call(0,{action:'join',minutes:15})).game.id,match.id);
  const privateGame=await clients[2].client.from('online_games').select('*').eq('id',match.id);assert.equal(privateGame.data.length,0);
  const tamper=await clients[0].client.rpc('online_commit',{p_game:match.id,p_version:0,p_actor:users[0],p_kind:'resign'});assert.ok(tamper.error);
  const illegal=await clients[white].client.functions.invoke('multiplayer',{body:{action:'move',game_id:match.id,version:0,from:'e2',to:'e5'}});assert.ok(illegal.error);
  server=await createServer({server:{host:'127.0.0.1',port:0,open:false}});await server.listen();
  browser=await chromium.launch({channel:'msedge',headless:true});
  const contexts=[],pages=[],errors=[];
  for (const index of [white,black]) {
    const context=await browser.newContext();contexts.push(context);
    await context.addInitScript(session=>{
      if (!['http:','https:'].includes(location.protocol)) return;
      localStorage.setItem('sb-nlwtzggjjbacndirlggj-auth-token',JSON.stringify(session));
      localStorage.setItem('neon-knights-sound-v1','off');localStorage.setItem('neon-knights-music-v1','off');
      localStorage.setItem('arcade-gambit-storage-notice-v1','acknowledged');
    },clients[index].session);
    const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));pages.push(page);
    await page.goto(`${server.resolvedUrls.local[0]}#online/${match.id}`);
    await page.getByRole('group',{name:'Online chessboard',exact:true}).waitFor();
  }
  const [wp,bp]=pages;
  await wp.goto(`${server.resolvedUrls.local[0]}#online/review/${match.id}`);
  await wp.getByRole('heading',{name:'Game still in progress',exact:true}).waitFor();
  assert.equal(await wp.getByRole('heading',{name:'Game review',exact:true}).count(),0);
  await wp.getByRole('button',{name:'Resume match',exact:true}).click();
  await wp.getByRole('group',{name:'Online chessboard',exact:true}).waitFor();
  const square=(page,name)=>page.getByRole('group',{name:'Online chessboard',exact:true}).getByRole('button',{name:new RegExp(`^${name}( |$)`)});
  // Black can queue and cancel a premove before White starts, including by drag.
  await square(bp,'g8').click();await square(bp,'f6').click();
  await bp.getByRole('button',{name:'Cancel premove from g8 to f6',exact:true}).click();
  await square(bp,'e7').click();await square(bp,'e5').click();
  await bp.getByRole('button',{name:'Cancel premove from e7 to e5',exact:true}).waitFor();
  await square(wp,'e2').scrollIntoViewIfNeeded();
  const from=await square(wp,'e2').boundingBox(),to=await square(wp,'e4').boundingBox();
  await wp.mouse.move(from.x+from.width/2,from.y+from.height/2);await wp.mouse.down();
  await wp.mouse.move(to.x+to.width/2,to.y+to.height/2,{steps:8});await wp.mouse.up();
  await wp.getByText('Your move',{exact:true}).waitFor();
  await wp.locator('.online-moves li').nth(1).waitFor();
  assert.equal(await bp.getByRole('button',{name:'Cancel premove from e7 to e5',exact:true}).count(),0);
  await wp.locator('.online-appearance summary').click();
  await wp.getByRole('button',{name:'Use the ocean board colors',exact:true}).click();
  assert.equal(await square(wp,'a8').evaluate(element=>getComputedStyle(element).backgroundColor),'rgb(196, 225, 234)');
  await wp.getByRole('button',{name:'Use Classic 2D piece design',exact:true}).click();
  await wp.locator('.online-board img[src*="classic-2d"]').first().waitFor();
  const soundRequests=[];wp.on('request',request=>{if(request.url().includes('/sound-board-theme/'))soundRequests.push(request.url());});
  await wp.getByRole('button',{name:'Enable sound effects',exact:true}).click();
  await wp.getByRole('button',{name:'Use Paper & Wood sound theme',exact:true}).click();
  await square(wp,'g1').click();
  await wp.waitForFunction(()=>performance.getEntriesByType('resource').some(entry=>entry.name.includes('/sound-board-theme/paper-wood/')));
  await wp.getByRole('button',{name:'Mute sound effects',exact:true}).click();
  await wp.locator('.online-appearance summary').click();
  await wp.reload();await wp.getByText('Your move',{exact:true}).waitFor();
  assert.equal(await wp.locator('.online-moves li').count(),2);
  assert.equal(await wp.locator('.online-board img[src*="classic-2d"]').count(),32);
  assert.ok((await wp.getByLabel('White clock').innerText()).startsWith('2:'));
  for(const width of [1440,900,390,320]) {
    await wp.setViewportSize({width,height:900});
    assert.ok(await wp.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),`No overflow at ${width}`);
    const box=await wp.getByRole('group',{name:'Online chessboard',exact:true}).boundingBox();assert.ok(box.width>0&&box.x>=0&&box.x+box.width<=width);
  }
  await wp.screenshot({path:'.tmp/online-play-mobile.png',fullPage:true});
  await wp.setViewportSize({width:1440,height:1000});await wp.screenshot({path:'.tmp/online-play-desktop.png',fullPage:true});
  await wp.getByRole('button',{name:'Back to home',exact:true}).click();
  const whiteCard=wp.locator('.online-home-card');await whiteCard.getByRole('button',{name:'Resume',exact:true}).waitFor();
  await whiteCard.getByRole('timer').waitFor();
  const inspected=(await call(white,{action:'active'})).game;
  const inspectedAgain=(await call(white,{action:'active'})).game;
  assert.equal(inspected.white_seen_at,inspectedAgain.white_seen_at,'Home inspection never refreshes the heartbeat');
  await whiteCard.getByRole('button',{name:'Resume',exact:true}).click();await wp.getByRole('group',{name:'Online chessboard',exact:true}).waitFor();
  await bp.getByRole('button',{name:'Back to home',exact:true}).click();
  const blackCard=bp.locator('.online-home-card');await blackCard.getByRole('button',{name:'Resign current game',exact:true}).click();
  await blackCard.getByRole('button',{name:'Confirm resignation',exact:true}).click();
  await wp.getByRole('heading',{name:'Victory',exact:true}).waitFor();
  await bp.getByRole('heading',{name:'Defeat',exact:true}).waitFor();
  await wp.waitForFunction(()=>[...document.querySelectorAll('.online-result .review-accuracy-scores strong')].every(el=>el.textContent.includes('%')));
  await wp.getByText('Your Elo change: +20',{exact:true}).waitFor();
  await bp.getByText('Your Elo change: -20',{exact:true}).waitFor();
  match=(await call(white,{action:'state',game_id:match.id})).game;assert.equal(match.white_delta,20);assert.equal(match.black_delta,-20);
  await call(black,{action:'resign',game_id:match.id});
  const ratings=await admin.from('online_players').select('*').in('user_id',users.slice(0,2));assert.ifError(ratings.error);
  assert.deepEqual(ratings.data.map(row=>row.rating).sort(),[1180,1220]);
  const publicHistory=await clients[2].client.from('online_games').select('*').eq('id',match.id);assert.equal(publicHistory.data.length,1);
  await wp.getByRole('button',{name:'New 3-minute game',exact:true}).click();
  await wp.getByRole('button',{name:'Cancel search',exact:true}).click();
  await wp.goto(`${server.resolvedUrls.local[0]}#online/${match.id}`);
  await wp.getByRole('button',{name:'Review game',exact:true}).click();
  await wp.getByRole('heading',{name:'Game review',exact:true}).waitFor();
  assert.equal(await wp.getByText('Known automated opponent',{exact:true}).count(),0);
  await wp.getByRole('button',{name:'Back to online play',exact:true}).click();
  await wp.getByRole('heading',{name:'Online game history',exact:true}).waitFor();
  await wp.getByRole('button',{name:'Community games',exact:true}).click();
  await wp.locator('.online-history .history-item').first().waitFor();
  await wp.getByRole('button',{name:'15 min',exact:true}).click();
  await wp.getByRole('button',{name:'Find opponent',exact:true}).click();
  await wp.getByRole('button',{name:'Cancel search',exact:true}).waitFor();
  await wp.getByRole('button',{name:'Cancel search',exact:true}).click();
  await wp.getByRole('button',{name:'Find opponent',exact:true}).waitFor();
  // Accelerate only the test account's development queue; the server still decides fallback.
  await call(white,{action:'join',minutes:5});
  const aging=await admin.from('online_queue').update({queued_at:new Date(Date.now()-21000).toISOString()}).eq('user_id',users[white]);assert.ifError(aging.error);
  let bot=(await call(white,{action:'join',minutes:5})).game;games.push(bot.id);assert.equal(bot.is_bot,true);
  await wp.goto(`${server.resolvedUrls.local[0]}#online/${bot.id}`);
  await wp.getByRole('group',{name:'Online chessboard',exact:true}).waitFor();
  await square(wp,'e2').click();await square(wp,'e4').click();
  await wp.getByText('Bot is thinking…',{exact:true}).waitFor();
  await square(wp,'g1').click();await square(wp,'f3').click();
  await wp.locator('.online-moves li').nth(2).waitFor();
  assert.match(await wp.locator('.online-moves li').nth(2).innerText(),/Nf3/);
  bot=(await call(white,{action:'state',game_id:bot.id})).game;assert.ok(bot.ply_count>=3);
  bot=(await call(white,{action:'resign',game_id:bot.id})).game;assert.equal(bot.rated,false);assert.equal(bot.white_delta,0);
  // A real page exit starts a reconnect countdown. Returning before it expires
  // clears it; missing the subsequent deadline loses even on the return request.
  await call(0,{action:'join',minutes:10});
  const reconnect=(await call(1,{action:'join',minutes:10})).game;games.push(reconnect.id);
  for (const page of [wp,bp]) {
    await page.goto(`${server.resolvedUrls.local[0]}#online/${reconnect.id}`);
    await page.getByRole('group',{name:'Online chessboard',exact:true}).waitFor();
  }
  await wp.goto('about:blank');
  await bp.getByText(/Opponent reconnecting/).waitFor();
  await wp.goto(`${server.resolvedUrls.local[0]}#online/${reconnect.id}`);
  await wp.getByRole('group',{name:'Online chessboard',exact:true}).waitFor();
  const returned=(await call(white,{action:'state',game_id:reconnect.id})).game;assert.equal(returned.result,null);
  await contexts[0].setOffline(true);
  await bp.getByText(/20-second reconnect window expired/).waitFor({timeout:30000});
  await contexts[0].setOffline(false);
  await wp.reload();await wp.getByText(/20-second reconnect window expired/).waitFor();
  const forfeited=(await call(white,{action:'state',game_id:reconnect.id})).game;
  assert.equal(forfeited.result,forfeited.white_id===users[white]?'0-1':'1-0');
  assert.equal(forfeited.rated,false);
  assert.deepEqual(errors,[]);
  console.log('PASS live development: human/bot games, drag, premove/cancel, theme persistence, sound assets, clocks, reload, Elo ±20, history/review, browser exit/reconnect, 20-second forfeit, mobile layout');
} finally {
  await browser?.close();await server?.close();
  if(games.length) { await admin.from('online_seats').delete().in('game_id',games); await admin.from('online_games').delete().in('id',games); }
  for(const user of users) await admin.auth.admin.deleteUser(user);
}
