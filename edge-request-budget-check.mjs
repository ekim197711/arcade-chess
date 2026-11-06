import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'file:///C:/Users/mikem/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
const uid='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const user={id:uid,aud:'authenticated',role:'authenticated',email:'budget@example.com',app_metadata:{},user_metadata:{full_name:'Budget test'},created_at:'2026-01-01T00:00:00Z'};
const live=process.argv.includes('--live');
const apiOrigin=live?'https://smdwmvfkyumxuxbnzitq.supabase.co':'https://edge-budget.supabase.co';
const authStorage=live?'sb-smdwmvfkyumxuxbnzitq-auth-token':'sb-edge-budget-auth-token';
const server=await createServer({define:{'import.meta.env.VITE_SUPABASE_DEV_URL':JSON.stringify('https://edge-budget.supabase.co'),'import.meta.env.VITE_SUPABASE_DEV_PUBLISHABLE_KEY':JSON.stringify('sb_publishable_test')},server:{host:'127.0.0.1',port:0,open:false}});
let browser;
try{
  const {Chess}=await server.ssrLoadModule('/src/chess.ts');if(!live)await server.listen();
  browser=await chromium.launch({channel:'msedge',headless:true});
  const fresh=(bot=false)=>({id:crypto.randomUUID(),white_id:uid,black_id:bot?null:other,white_name:'Budget test',black_name:bot?'Practice bot':'Opponent',white_rating:1200,black_rating:1200,is_bot:bot,minutes:5,pgn:'',fen:new Chess().fen(),turn:'w',white_ms:300000,black_ms:300000,turn_started_at:new Date().toISOString(),created_at:new Date().toISOString(),finished_at:null,result:null,reason:'',version:0,ply_count:0,draw_offer:null,rated:false,white_delta:0,black_delta:0,white_seen_at:new Date().toISOString(),black_seen_at:new Date().toISOString(),white_disconnected_at:null,black_disconnected_at:null});
  for(const mode of ['human','bot','queue','forbidden','unavailable','unsaved','saved-no-reply']){
    const page=await browser.newPage({viewport:{width:1280,height:950}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    let game=fresh(mode==='bot'),edgeCalls=0,reads=0,matchmaking=0,cancels=0,deltas=0,botDue=mode==='bot';
    if(mode==='bot'){const board=new Chess();board.move('e4');Object.assign(game,{pgn:board.pgn(),fen:board.fen(),turn:'b',ply_count:1,version:1});}
    await page.route(`${apiOrigin}/**`,async route=>{
      const path=new URL(route.request().url()).pathname;let data;
      if(path.endsWith('/online_state')){
        reads++;
        if(mode==='forbidden'||mode==='unavailable')return route.fulfill({status:mode==='forbidden'?403:503,contentType:'application/json',body:JSON.stringify({code:mode==='forbidden'?'42501':'XX000',message:mode==='forbidden'?'Game not found':'Temporarily unavailable'})});
        const {p_game,p_version}=route.request().postDataJSON();assert.equal(p_game,game.id);
        data={server_now:new Date().toISOString(),edge_required:botDue};
        if(p_version===game.version){deltas++;data.presence={game_id:game.id,version:game.version,white_seen_at:new Date().toISOString(),black_seen_at:new Date().toISOString(),white_disconnected_at:null,black_disconnected_at:null};}
        else data.game=game;
      }else if(path.endsWith('/online_matchmake')){
        const args=route.request().postDataJSON();matchmaking++;if(args.p_cancel)cancels++;
        data={queued:!args.p_cancel,fallback_at:new Date(Date.now()+20000).toISOString(),server_now:new Date().toISOString()};
      }else if(path.endsWith('/multiplayer')){
        edgeCalls++;const args=route.request().postDataJSON();const board=new Chess();if(game.pgn)board.loadPgn(game.pgn);
        if(args.action==='move'){
          if(mode==='unsaved')return route.fulfill({status:503,contentType:'application/json',body:'{"error":"Simulated connection interruption"}'});
          board.move({from:args.from,to:args.to,promotion:args.promotion});
        }
        else {assert.equal(args.action,'state');assert(botDue,'state Edge calls only for due bot/adjudication');board.move('e5');botDue=false;}
        Object.assign(game,{pgn:board.pgn(),fen:board.fen(),turn:board.turn(),version:game.version+1,ply_count:board.history().length});
        if(mode==='saved-no-reply')return route.fulfill({status:503,contentType:'application/json',body:'{"error":"Simulated lost reply"}'});
        data={game,server_now:new Date().toISOString()};
      }else if(path.endsWith('/online_social'))data={friends:[],messages:[],reactions:[],emojis_enabled:true,peer_emojis_enabled:true};
      else if(path.endsWith('/online_disconnect'))data=null;
      else if(path.endsWith('/app_heartbeat'))data='user';
      else if(path.endsWith('/player_progress'))data={progress:{}};
      else if(path.endsWith('/player_games'))data=[];
      else if(path.endsWith('/online_players'))data={rating:1200};
      else if(path.endsWith('/online_games'))data=new URL(route.request().url()).searchParams.get('result')==='is.null'?null:[];
      else if(path.endsWith('/user'))data=user;
      else throw new Error('Unexpected request '+path);
      await route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
    });
    await page.addInitScript(({user,authStorage})=>{
      localStorage.setItem(authStorage,JSON.stringify({access_token:'fake',refresh_token:'fake',expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user}));
      localStorage.setItem('arcade-gambit-storage-notice-v1','acknowledged');localStorage.setItem('neon-knights-sound-v1','off');localStorage.setItem('neon-knights-music-v1','off');
    },{user,authStorage});
    await page.clock.install();
    await page.goto((live?'https://www.arcadegambit.com/':server.resolvedUrls.local[0])+'#online/'+(mode==='queue'?'new/5':game.id));
    if(mode==='forbidden'||mode==='unavailable')await page.getByRole('alert').first().waitFor();
    else if(mode==='queue')await page.getByRole('button',{name:'Cancel search',exact:true}).waitFor();
    else await page.getByRole('group',{name:'Online chessboard',exact:true}).waitFor();
    if(mode==='bot')await page.waitForFunction(()=>document.querySelector('.online-board [data-square="e5"]')?.getAttribute('aria-label')?.includes('Black p'));
    const readsBefore=reads;
    await page.evaluate(()=>{for(let i=0;i<100;i++)window.dispatchEvent(new Event('focus'));});
    await page.waitForTimeout(30);assert(reads<=readsBefore+1,'100 focus events cause at most one due refresh');
    await page.clock.runFor(mode==='unavailable'||mode==='forbidden'?60000:30000);
    if(mode==='forbidden'){
      assert.equal(reads,1,'permanent errors stop automatic retry');assert.equal(edgeCalls,0);
      await page.getByRole('button',{name:'Reconnect',exact:true}).click();assert.equal(reads,2,'explicit retry remains available');
    }else if(mode==='unavailable'){assert(reads<=10,`transient failures back off (${reads} reads)`);assert.equal(edgeCalls,0);}
    else if(mode==='queue'){
      assert(matchmaking>=3);assert.equal(edgeCalls,0,'queue search never invokes Edge');
      await page.getByRole('button',{name:'Cancel search',exact:true}).click();assert.equal(cancels,1);assert.equal(edgeCalls,0);
    }else if(mode==='bot'){assert.equal(edgeCalls,1,'one bot decision, zero Edge heartbeats');assert(deltas>=5);}
    else if(mode==='unsaved'||mode==='saved-no-reply'){
      const moved=page.waitForResponse(response=>response.url().endsWith('/multiplayer'));
      await page.locator('.online-board [data-square="e2"]').click();await page.locator('.online-board [data-square="e4"]').click();await moved;
      await page.getByRole('alert').first().waitFor();
      await page.clock.runFor(2200);
      if(mode==='unsaved'){
        await page.getByText('Move was not saved.',{exact:false}).waitFor();
        assert.match(await page.locator('.online-board [data-square="e2"]').getAttribute('aria-label'),/White p/);
      }else assert.match(await page.locator('.online-board [data-square="e4"]').getAttribute('aria-label'),/White p/);
      assert.equal(edgeCalls,1,'uncertain moves reconcile through a full RPC read without resending');
      assert.equal(await page.getByRole('alert').count(),0);
    }else {
      assert.equal(edgeCalls,0,'human game can poll indefinitely without Edge invocations');assert(deltas>=5);
      const moved=page.waitForResponse(response=>response.url().endsWith('/multiplayer'));
      await page.locator('.online-board [data-square="e2"]').click();await page.locator('.online-board [data-square="e4"]').click();
      await moved;
      assert.equal(edgeCalls,1,'a player move still uses the trusted Edge validator');
      const board=new Chess();board.loadPgn(game.pgn);board.move('e5');Object.assign(game,{pgn:board.pgn(),fen:board.fen(),turn:'w',version:2,ply_count:2});
      await page.clock.runFor(2200);
      assert.match(await page.locator('.online-board [data-square="e5"]').getAttribute('aria-label'),/Black p/);
      assert.equal(edgeCalls,1,'opponent updates arrive through RPC');
      Object.assign(game,{result:'1/2-1/2',reason:'Draw by agreement',version:3});await page.clock.runFor(2200);
      await page.getByRole('heading',{name:'Draw',exact:true}).waitFor();const stopped=reads;await page.clock.runFor(10000);assert.equal(reads,stopped,'completed matches stop state polling');
      await page.getByRole('button',{name:'Review game',exact:true}).click();await page.clock.runFor(100);
      assert.equal(edgeCalls,1,'completed review never invokes Edge');
    }
    assert.deepEqual(errors,[]);console.log(`PASS ${live?'deployed':'local'} ${mode} (mocked API): ${edgeCalls} Edge calls, ${reads} state RPCs, ${matchmaking} matchmaking RPCs.`);await page.close();
  }
}finally{await browser?.close();await server.close();}
