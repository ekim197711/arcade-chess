import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {Chess} from 'chess.js';
import {chromium} from 'file:///C:/Users/mikem/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
const api='https://result-layout-check.supabase.co';
const server=await createServer({define:{'import.meta.env.VITE_SUPABASE_DEV_URL':JSON.stringify(api),'import.meta.env.VITE_SUPABASE_DEV_PUBLISHABLE_KEY':JSON.stringify('sb_publishable_test')},server:{host:'127.0.0.1',port:0,open:false}});
let browser;
try{
 await server.listen();browser=await chromium.launch({channel:'msedge',headless:true});
 const id='11111111-1111-4111-8111-111111111111',peer='22222222-2222-4222-8222-222222222222';
 const user={id,aud:'authenticated',role:'authenticated',email:'result-layout@example.invalid',app_metadata:{},user_metadata:{full_name:'Result test'},created_at:'2026-01-01T00:00:00Z'};
 for(const bot of [false,true])for(const outcome of ['win','loss'])for(const [width,height]of [[1440,900],[1024,768],[390,844],[320,640],[740,360]]){
  const page=await browser.newPage({viewport:{width,height}});page.setDefaultTimeout(12000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));let socialReads=0;
  const chess=new Chess();chess.loadPgn(outcome==='win'?'1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7#':'1. f3 e5 2. g4 Qh4#');
  const game={id:'result-game',white_id:id,black_id:bot?null:peer,white_name:'Result test',black_name:bot?'Practice bot':'Human opponent',white_rating:1200,black_rating:1200,is_bot:bot,minutes:5,white_ms:225000,black_ms:132000,pgn:chess.pgn(),fen:chess.fen(),turn:chess.turn(),version:chess.history().length,ply_count:chess.history().length,result:outcome==='win'?'1-0':'0-1',reason:'Checkmate',rated:!bot,white_delta:outcome==='win'?12:-12,black_delta:outcome==='win'?-12:12,draw_offer:null,created_at:new Date().toISOString(),finished_at:new Date().toISOString(),turn_started_at:new Date().toISOString(),white_seen_at:new Date().toISOString(),black_seen_at:new Date().toISOString()};
  await page.route(api+'/**',route=>{
   const url=new URL(route.request().url());let data=[];
   if(url.pathname.endsWith('/user'))data=user;
   else if(url.pathname.endsWith('/app_heartbeat'))data='user';
   else if(url.pathname.endsWith('/player_progress'))data={progress:{}};
   else if(url.pathname.endsWith('/online_players'))data={rating:1200};
   else if(url.pathname.endsWith('/online_games'))data=url.searchParams.get('result')==='is.null'?null:[];
   else if(url.pathname.endsWith('/online_state'))data={game,server_now:new Date().toISOString()};
   else if(url.pathname.endsWith('/online_matchmake'))data={queued:true,server_now:new Date().toISOString(),fallback_at:new Date(Date.now()+20000).toISOString()};
   else if(url.pathname.endsWith('/online_social')){socialReads++;data={friends:[],messages:[],reactions:[],emojis_enabled:true,peer_emojis_enabled:true};}
   return route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.addInitScript(({user})=>{
   localStorage.setItem('sb-result-layout-check-auth-token',JSON.stringify({access_token:'fake',refresh_token:'fake',expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user}));
   localStorage.setItem('neon-knights-sound-v1','off');localStorage.setItem('neon-knights-music-v1','off');localStorage.setItem('arcade-gambit-storage-notice-v1','acknowledged');
  },{user});
  await page.goto(server.resolvedUrls.local[0]+'#online/result-game');
  await page.getByRole('heading',{name:outcome==='win'?'Victory':'Defeat',exact:true}).waitFor();await page.evaluate(()=>document.fonts.ready);
  const result=page.locator('.online-result'),actions=page.getByRole('navigation',{name:'Match result actions'}),stats=page.getByRole('region',{name:'Match statistics'});
  const a=await actions.boundingBox(),s=await stats.boundingBox(),overview=await result.locator('.online-result-overview').boundingBox();
  assert(a.y+a.height<=s.y,'actions precede all statistics');
  assert(a.y>=0&&a.y+a.height<=height,'every action is visible without scrolling');
  if(height>=640&&overview.y+overview.height>height){
    await page.screenshot({path:'.tmp/online-result-overflow.png',fullPage:true});
    console.log(JSON.stringify(await page.evaluate(()=>['.online-result','.online-result-actions','.online-result-summary','.online-result h1','.online-result .result-stats','.online-result .review-accuracy','.online-result .review-accuracy-scores'].map(selector=>{const element=document.querySelector(selector),b=element.getBoundingClientRect(),c=getComputedStyle(element);return{selector,y:b.y,height:b.height,padding:c.padding,margin:c.margin,font:c.fontSize,display:c.display,gap:c.gap}}))));
  }
  if(height>=640){assert(s.y+s.height<=height,`match stats fit ${width}x${height}: ${JSON.stringify(s)}`);assert(overview.y+overview.height<=height,`accuracy fits ${width}x${height}: ${JSON.stringify(overview)}`);}
  assert.equal(await stats.locator('dl > div').count(),6);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  if(bot){const b=await page.getByRole('group',{name:'Final chessboard'}).boundingBox();assert(b.y>=overview.y+overview.height,'bot final board follows stats');}
  assert.equal(socialReads,0,'closed post-match chat makes no requests');
  if(width===390){
   await result.locator('.online-result-social > summary').click();await result.getByRole('tab',{name:'Chat',exact:true}).waitFor();assert.equal(socialReads,1);
   await result.locator('.online-result-social > summary').click();
  }
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:`.tmp/online-result-${bot?'bot':'human'}-${outcome}-${width}.png`,fullPage:true});
  if(width===1440){await actions.getByRole('button',{name:'New 5-minute game',exact:true}).click();await page.waitForURL(/\/#online\/new\/5(?:\/(?:standard|freestyle))?$/);}
  else if(width===1024){await actions.getByRole('button',{name:'Review game',exact:true}).click();await page.waitForURL('**/#online/review/result-game');}
  else if(width===390){await actions.getByRole('button',{name:'Back to home',exact:true}).click();await page.waitForURL('**/#home');}
  else{await actions.getByRole('button',{name:'Choose time control',exact:true}).click();await page.waitForURL('**/#online');}
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS online result layouts: human/bot victories and defeats, top actions with all four working routes, six compact stats plus accuracy visible at 320–1440px, landscape, final-board order and lazy chat requests.');
}finally{await browser?.close();await server.close();}
