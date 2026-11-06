// Development only. Management/service credentials remain in this Node process.
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
const ref='nlwtzggjjbacndirlggj',url=`https://${ref}.supabase.co`;
const token=process.env.ARCADE_TEST_MANAGEMENT_TOKEN;delete process.env.ARCADE_TEST_MANAGEMENT_TOKEN;
assert(token,'Saved management credential required');
const response=await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys`,{headers:{Authorization:`Bearer ${token}`}});assert(response.ok);
const payload=await response.json(),keys=Array.isArray(payload)?payload:payload.value??payload.keys;
const service=keys.find(key=>key.name==='service_role')?.api_key;
const publicKey=keys.find(key=>key.name==='anon')?.api_key??keys.find(key=>key.type==='publishable')?.api_key;
assert(service&&publicKey);
const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}}),users=[],clients=[];
try{
 for(let index=0;index<3;index++){
  const email=`social-check-${crypto.randomUUID()}@example.com`,password=crypto.randomUUID()+crypto.randomUUID();
  const created=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:'Social test'}});assert.ifError(created.error);users.push(created.data.user.id);
  const client=createClient(url,publicKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const signed=await client.auth.signInWithPassword({email,password});assert.ifError(signed.error);clients.push(client);
 }
 const rpc=async(index,name,args)=>{const result=await clients[index].rpc(name,args);assert.ifError(result.error);return result.data;};
 await rpc(0,'online_matchmake',{p_minutes:5});
 const game=(await rpc(1,'online_matchmake',{p_minutes:5})).game;assert(game&&!game.is_bot);
 const social=(index,action,extra={})=>rpc(index,'online_social',{p_action:action,p_game:game.id,...extra});
 const sent=await social(0,'chat',{p_body:'Hello from the match!'});assert.equal(sent.friends.length,0);assert.equal(sent.messages.at(-1).body,'Hello from the match!');
 const received=await social(1,'state');assert.equal(received.messages.at(-1).sender_id,users[0]);
 const denied=await clients[2].rpc('online_social',{p_action:'state',p_game:game.id});assert(denied.error,'outsider cannot read match messages');
 const lobby=await rpc(1,'online_social',{p_action:'state',p_peer:users[0]});assert.equal(lobby.messages.length,0);
 const privateDenied=await clients[0].rpc('online_social',{p_action:'chat',p_peer:users[1],p_body:'Not friends yet'});assert(privateDenied.error);
 assert.equal((await social(0,'emoji',{p_body:'🔥'})).reactions.at(-1).body,'🔥');
 await social(1,'preferences',{p_enabled:false});
 const muted=await clients[0].rpc('online_social',{p_action:'emoji',p_game:game.id,p_body:'🏆'});assert(muted.error);
 console.log('PASS real development social: match chat without friendship, peer delivery, outsider denial, lobby isolation, Unicode expanded emoji and account mute. No Edge Function calls.');
}finally{
 for(const client of clients)await client.auth.signOut().catch(()=>{});
 for(const id of users){const result=await admin.auth.admin.deleteUser(id);if(result.error)throw result.error;}
}
