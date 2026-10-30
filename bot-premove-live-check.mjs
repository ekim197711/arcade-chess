// Isolated development test; service credentials stay in Node, never the page.
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { createServer } from 'vite';
import { chromium } from 'file:///C:/Users/mikem/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
const ref='nlwtzggjjbacndirlggj',url=`https://${ref}.supabase.co`;
const management=process.env.ARCADE_TEST_MANAGEMENT_TOKEN;delete process.env.ARCADE_TEST_MANAGEMENT_TOKEN;
assert(management,'Saved management credential required');
const keyResponse=await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys`,{headers:{Authorization:`Bearer ${management}`}});assert(keyResponse.ok);
const keys=await keyResponse.json();
const service=keys.find(key=>key.name==='service_role')?.api_key,publicKey=keys.find(key=>key.name==='anon')?.api_key;
assert(service&&publicKey);
const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
const client=createClient(url,publicKey,{auth:{persistSession:false,autoRefreshToken:false}});
let userId,gameId,browser,server,page;let confirmedMoves=0;const errors=[],moves=[];
try{
  const password=crypto.randomUUID()+crypto.randomUUID(),email=`bot-premove-${crypto.randomUUID()}@example.com`;
  const created=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:'Bot premove test'}});assert.ifError(created.error);userId=created.data.user.id;
  const signed=await client.auth.signInWithPassword({email,password});assert.ifError(signed.error);
  const rpc=async(name,args)=>{const result=await client.rpc(name,args);assert.ifError(result.error);return result.data;};
  await rpc('online_matchmake',{p_minutes:5});
  const age=await admin.from('online_queue').update({queued_at:new Date(Date.now()-21000).toISOString()}).eq('user_id',userId);assert.ifError(age.error);
  const game=(await rpc('online_matchmake',{p_minutes:5})).game;assert(game.is_bot);gameId=game.id;
  server=await createServer({server:{host:'127.0.0.1',port:0,open:false}});await server.listen();
  browser=await chromium.launch({channel:'msedge',headless:true});
  page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(error.message));
  await page.route(`${url}/functions/v1/multiplayer`,async route=>{
    const input=route.request().postDataJSON();if(input.action==='move')moves.push({from:input.from,to:input.to});
    try {
      const response=await route.fetch();await new Promise(resolve=>setTimeout(resolve,1000));await route.fulfill({response});
      if(input.action==='move'&&response.ok())confirmedMoves++;
    }catch{if(!page.isClosed())errors.push('Test request interception failed');await route.abort().catch(()=>{});}
  });
  await page.addInitScript(({session,ref})=>{
    localStorage.setItem(`sb-${ref}-auth-token`,JSON.stringify(session));localStorage.setItem('arcade-gambit-storage-notice-v1','acknowledged');
    localStorage.setItem('neon-knights-sound-v1','off');localStorage.setItem('neon-knights-music-v1','off');
  },{session:signed.data.session,ref});
  await page.goto(`${server.resolvedUrls.local[0]}#online/${gameId}`);
  const board=page.getByRole('group',{name:'Online chessboard',exact:true});await board.waitFor();
  const square=name=>board.locator(`[data-square="${name}"]`);
  await square('e2').click();await square('e4').click();
  await square('g1').click();await square('f3').click();
  await square('b1').click();await square('c3').click();
  await page.getByRole('button',{name:'Cancel all 2 premoves',exact:true}).waitFor();
  await page.waitForFunction(()=>document.querySelectorAll('.online-moves li').length>=5);
  const deadline=Date.now()+20000;
  while(confirmedMoves<3&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,100));
  assert.equal(confirmedMoves,3,'wait for committed replies, not just optimistic moves');
  const saved=(await rpc('online_state',{p_game:gameId})).game;
  assert(saved.ply_count>=5);assert.deepEqual(moves.slice(0,3),[{from:'e2',to:'e4'},{from:'g1',to:'f3'},{from:'b1',to:'c3'}]);
  assert.equal(await page.locator('.premove-cancel').count(),0);assert.deepEqual(errors,[]);
  console.log('PASS real fallback bot: queued while first move saving, two premoves sent in order after real bot replies, one send per move, confirmed in the database.');
}catch(error){console.error(error.message);console.error('Player moves:',JSON.stringify(moves));process.exitCode=1;}
finally{
  await page?.unrouteAll({behavior:'wait'});await browser?.close();await server?.close();
  if(gameId){await admin.from('online_seats').delete().eq('game_id',gameId);await admin.from('online_games').delete().eq('id',gameId);await admin.from('app_completed_games').delete().eq('game_key','online:'+gameId);}
  if(userId){await admin.from('online_queue').delete().eq('user_id',userId);await admin.auth.admin.deleteUser(userId);}
}
