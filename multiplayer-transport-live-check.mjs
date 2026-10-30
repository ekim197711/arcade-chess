// Development only. The management credential is passed through process memory.
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
const ref='nlwtzggjjbacndirlggj',url=`https://${ref}.supabase.co`;
const token=process.env.ARCADE_TEST_MANAGEMENT_TOKEN;delete process.env.ARCADE_TEST_MANAGEMENT_TOKEN;
assert(token,'Saved management credential required');
const response=await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys`,{headers:{Authorization:`Bearer ${token}`}});
assert(response.ok,'Could not obtain development test credentials');
const payload=await response.json();const keys=Array.isArray(payload)?payload:payload.value??payload.keys;
const serviceKey=keys?.find(key=>key.name==='service_role')?.api_key;
const clientKey=keys?.find(key=>key.name==='anon')?.api_key??keys?.find(key=>key.type==='publishable')?.api_key;
assert(serviceKey&&clientKey,'Development API keys unavailable');
const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
const users=[],clients=[],games=[];let edgeCalls=0;
try{
  for(let i=0;i<3;i++){
    const email=`transport-check-${crypto.randomUUID()}@example.com`,password=crypto.randomUUID()+crypto.randomUUID();
    const created=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:'Transport test'}});assert.ifError(created.error);users.push(created.data.user.id);
    const client=createClient(url,clientKey,{auth:{persistSession:false,autoRefreshToken:false}});const signed=await client.auth.signInWithPassword({email,password});assert.ifError(signed.error);clients.push(client);
  }
  const rpc=async(index,name,args)=>{const {data,error}=await clients[index].rpc(name,args);assert.ifError(error);return data;};
  const edge=async(index,body)=>{edgeCalls++;const {data,error}=await clients[index].functions.invoke('multiplayer',{body});assert.ifError(error);assert(!data.error);return data;};
  assert.equal((await rpc(0,'online_matchmake',{p_minutes:5})).queued,true);
  let game=(await rpc(1,'online_matchmake',{p_minutes:5})).game;games.push(game.id);
  const white=game.white_id===users[0]?0:1,black=1-white;
  assert.equal((await rpc(white,'online_state',{p_game:game.id})).game.id,game.id);
  const delta=await rpc(white,'online_state',{p_game:game.id,p_version:game.version});assert(!delta.game);assert(delta.presence);assert.equal(delta.edge_required,false);
  assert((await clients[2].rpc('online_state',{p_game:game.id})).error,'live games stay private');
  await rpc(white,'online_disconnect',{p_game:game.id});
  assert.equal((await rpc(white,'online_state',{p_game:game.id})).game.white_disconnected_at,null);
  game=(await edge(white,{action:'move',game_id:game.id,version:game.version,from:'e2',to:'e4'})).game;
  assert.equal((await rpc(black,'online_state',{p_game:game.id})).game.ply_count,1);
  game=(await edge(white,{action:'resign',game_id:game.id})).game;
  assert.equal((await rpc(2,'online_state',{p_game:game.id})).game.result,'0-1');
  await rpc(2,'online_matchmake',{p_minutes:3});
  const aged=await admin.from('online_queue').update({queued_at:new Date(Date.now()-21000).toISOString()}).eq('user_id',users[2]);assert.ifError(aged.error);
  let bot=(await rpc(2,'online_matchmake',{p_minutes:3})).game;games.push(bot.id);assert(bot.is_bot);
  bot=(await edge(2,{action:'move',game_id:bot.id,version:bot.version,from:'e2',to:'e4'})).game;
  await new Promise(resolve=>setTimeout(resolve,5100));
  assert.equal((await rpc(2,'online_state',{p_game:bot.id})).edge_required,true);
  bot=(await edge(2,{action:'state',game_id:bot.id})).game;assert.equal(bot.ply_count,2);
  assert.equal((await rpc(2,'online_state',{p_game:bot.id,p_version:bot.version})).edge_required,false);
  await edge(2,{action:'resign',game_id:bot.id});
  assert.equal(edgeCalls,5);
  console.log('PASS real development: authenticated RPC matchmaking, compact heartbeat, privacy, disconnect/reconnect, Edge-validated move, completed review and due bot decision; exactly 5 necessary Edge calls.');
}finally{
  if(games.length){await admin.from('online_seats').delete().in('game_id',games);await admin.from('online_games').delete().in('id',games);await admin.from('app_completed_games').delete().in('game_key',games.map(id=>'online:'+id));}
  if(users.length)await admin.from('online_queue').delete().in('user_id',users);
  for(const id of users){const result=await admin.auth.admin.deleteUser(id);if(result.error)console.error('Temporary user cleanup failed:',result.error.message);}
}
