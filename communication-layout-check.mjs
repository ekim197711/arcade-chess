import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {Chess} from 'chess.js';
import {chromium} from 'file:///C:/Users/mikem/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';

const live=process.argv.includes('--live');
const api=live?'https://smdwmvfkyumxuxbnzitq.supabase.co':'https://communication-check.supabase.co';
const authKey=live?'sb-smdwmvfkyumxuxbnzitq-auth-token':'sb-communication-check-auth-token';
const server=await createServer({define:{'import.meta.env.VITE_SUPABASE_DEV_URL':JSON.stringify(api),'import.meta.env.VITE_SUPABASE_DEV_PUBLISHABLE_KEY':JSON.stringify('sb_publishable_test')},server:{host:'127.0.0.1',port:0,open:false}});
let browser;
try{
 if(!live)await server.listen();
 const origin=live?'https://www.arcadegambit.com/':server.resolvedUrls.local[0];
 browser=await chromium.launch({channel:'msedge',headless:true});
 const id='11111111-1111-4111-8111-111111111111',peer='22222222-2222-4222-8222-222222222222';
 const user={id,aud:'authenticated',role:'authenticated',email:'communication@example.invalid',app_metadata:{},user_metadata:{full_name:'Communication test'},created_at:'2026-01-01T00:00:00Z'};
 const chess=new Chess();chess.move('e4');
 for(const width of [2560,1440,1024,390,320]){
  const page=await browser.newPage({viewport:{width,height:1000}});page.setDefaultTimeout(15000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  let bot=false,finished=false,enabled=true,messages=[],socialReads=0;
  const game=()=>({id:'communication-game',white_id:id,black_id:bot?null:peer,white_name:'You',black_name:bot?'Practice bot':'Opponent',white_rating:1200,black_rating:1200,is_bot:bot,minutes:5,white_ms:300000,black_ms:300000,pgn:chess.pgn(),fen:chess.fen(),turn:chess.turn(),version:1,ply_count:1,result:finished?'1-0':null,reason:finished?'Resignation':'',rated:false,white_delta:0,black_delta:0,draw_offer:null,created_at:new Date().toISOString(),finished_at:finished?new Date().toISOString():null,turn_started_at:new Date().toISOString(),white_seen_at:new Date().toISOString(),black_seen_at:new Date().toISOString(),white_disconnected_at:null,black_disconnected_at:null});
  await page.route(api+'/**',route=>{
   const url=new URL(route.request().url());let data=[];
   if(url.pathname.endsWith('/user'))data=user;
   else if(url.pathname.endsWith('/app_heartbeat'))data='administrator';
   else if(url.pathname.endsWith('/admin_statistics'))data={users:10,online:2,games:{today:1,hour:1,week:1,month:1},asOf:new Date().toISOString()};
   else if(url.pathname.endsWith('/player_progress'))data={progress:{}};
   else if(url.pathname.endsWith('/online_players'))data={rating:1200};
   else if(url.pathname.endsWith('/online_games'))data=url.searchParams.has('id')?game():url.searchParams.get('result')==='is.null'?null:[];
   else if(url.pathname.endsWith('/online_state'))data={game:game(),server_now:new Date().toISOString()};
   else if(url.pathname.endsWith('/online_social')){
    const input=route.request().postDataJSON();if(input.p_action==='state')socialReads++;
    if(input.p_action==='preferences')enabled=input.p_enabled;
    if(input.p_action==='chat')messages.push({id:messages.length+1,sender_id:id,body:input.p_body,created_at:new Date().toISOString()});
    data={friends:[],messages,reactions:[],emojis_enabled:enabled,peer_emojis_enabled:true};
   }
   return route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.addInitScript(({user,authKey})=>{
   localStorage.setItem(authKey,JSON.stringify({access_token:'fake',refresh_token:'fake',expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user}));
   localStorage.setItem('neon-knights-sound-v1','off');localStorage.setItem('neon-knights-music-v1','off');
   localStorage.setItem('arcade-gambit-storage-notice-v1','acknowledged');
  },{user,authKey});
  const assertWidth=async()=>{
   const main=await page.locator('.app-shell > main').boundingBox();assert(Math.abs(main.width-width)<2,'page uses full viewport width');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`no horizontal overflow at ${width}px`);
  };
  for(const route of ['home','settings','roster','online','administration']){
   await page.goto(origin+'#'+route);await page.locator('.app-shell > main').waitFor();
   if(route==='settings')await page.getByRole('checkbox',{name:'Emoji reactions enabled'}).waitFor();
   if(route==='administration')await page.getByRole('heading',{name:'Version & deployment',exact:true}).waitFor();
   await assertWidth();
   if(route==='online')assert.equal(await page.getByRole('checkbox',{name:'Emoji reactions enabled'}).count(),0,'no pre-game emoji toggle');
  }
  await page.goto(origin+'#online/communication-game');
  const board=page.getByRole('group',{name:'Online chessboard'});await board.waitFor();
  const chat=page.locator('.online-communication');await chat.getByRole('textbox',{name:'Message',exact:true}).fill('Hello <script>window.injected=true</script>');
  await chat.getByRole('tab',{name:'Chat',exact:true}).press('ArrowRight');
  assert.equal(await chat.getByRole('tab',{name:'Emojis',exact:true}).getAttribute('aria-selected'),'true');
  assert.equal(await chat.getByRole('group',{name:'Send an emoji reaction'}).getByRole('button').count(),48);
  await chat.getByRole('tab',{name:'Emojis',exact:true}).press('ArrowLeft');
  assert.equal(await chat.getByRole('textbox',{name:'Message',exact:true}).inputValue(),'Hello <script>window.injected=true</script>','switching tabs keeps the draft');
  await chat.getByRole('button',{name:'Send',exact:true}).click();
  await chat.getByText('Hello <script>window.injected=true</script>',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.injected),undefined);
  messages.push({id:messages.length+1,sender_id:peer,body:'Hello back!',created_at:new Date().toISOString()});
  await chat.getByText('Hello back!',{exact:true}).waitFor();assert(socialReads>1,'incoming chat updates');
  await assertWidth();
  const b=await board.boundingBox(),c=await chat.boundingBox();
  if(width>760)assert(c.x+c.width<=b.x+1,'communication is to the left of the board');else assert(c.y>b.y,'phone keeps the board above communication');
  await page.screenshot({path:`.tmp/communication-${live?'live':'local'}-${width}.png`,fullPage:true});
  bot=true;await page.reload();
  await chat.getByRole('textbox',{name:'Message',exact:true}).fill('Hello');await chat.getByRole('button',{name:'Send',exact:true}).click();
  await chat.getByText('Hello! Good luck and have fun.',{exact:true}).waitFor();await assertWidth();
  finished=true;await page.reload();await page.getByRole('heading',{name:'Victory',exact:true}).waitFor();await assertWidth();
  await page.goto(origin+'#online/review/communication-game');await page.getByLabel('Replay chessboard',{exact:true}).waitFor();await assertWidth();
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log(`PASS ${live?'deployed':'local'} communication and full-width pages: 2560/1440/1024/390/320px, left chat tabs, keyboard/draft preservation, escaped match messages, incoming messages, 48 emojis, bot replies, lobby/settings/roster/admin/results/review and no overflow. API mocked; no real user changes.`);
}finally{await browser?.close();await server.close();}
