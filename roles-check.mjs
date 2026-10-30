import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from './.tmp/ladder-check/node_modules/@electric-sql/pglite/dist/index.js';
const db=new PGlite();
try {
  await db.exec(`create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false,
    created_at timestamptz default now(),raw_user_meta_data jsonb default '{}',banned_until timestamptz);
    create role anon; create role authenticated; create role service_role;
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
  for(const file of ['schema','multiplayer','social','administration','roles','roles']) await db.exec(await readFile(`supabase/${file}.sql`,'utf8'));
  await db.exec('grant select,insert,update on public.player_progress to authenticated');
  const [owner,admin,user,unverified,anonymous]=Array.from({length:5},()=>crypto.randomUUID());
  for(const [id,email,verified,anon] of [[owner,'ekim197711@gmail.com',true,false],[admin,'admin@example.com',true,false],[user,'user@example.com',true,false],[unverified,'new@example.com',false,false],[anonymous,null,false,true]]) {
    await db.query(`insert into auth.users(id,email,email_confirmed_at,is_anonymous) values($1,$2,case when $3 then now() end,$4)`,[id,email,verified,anon]);
  }
  const as=async(id,sql,params=[])=>{
    await db.query("select set_config('test.uid',$1,false)",[id??'']); await db.exec('set role authenticated');
    try{return await db.query(sql,params);} finally {await db.exec('reset role');}
  };
  const role=async id=>(await as(id,'select public.app_role() as role')).rows[0].role;
  const heartbeat=async id=>(await as(id,'select public.app_heartbeat() as status')).rows[0].status;
  const grant=(actor,target,enabled=true)=>as(actor,'select public.admin_set_administrator($1,$2)',[target,enabled]);
  const moderate=(actor,target,action,until=null)=>as(actor,'select public.admin_moderate_user($1,$2,$3,$4)',[target,action,'Test moderation reason',until]);
  assert.equal(await role(owner),'user','An email alone never grants privilege');
  assert.equal(await role(user),'user'); assert.equal(await role(anonymous),null);
  await assert.rejects(grant(owner,admin),/Administrator access required/);
  await db.query('insert into public.app_administrators(user_id) values($1)',[owner]);
  assert.equal(await role(owner),'administrator');
  await grant(owner,admin); await grant(admin,user); // Every administrator can manage others.
  assert.equal(await role(user),'administrator');
  await grant(admin,user,false); assert.equal(await role(user),'user');
  await assert.rejects(grant(owner,owner,false),/another administrator/);
  await assert.rejects(moderate(owner,owner,'ban'),/own account/);
  await assert.rejects(grant(owner,unverified),/verify their email/);
  await db.query(`update auth.users set raw_user_meta_data='{"role":"administrator","email":"ekim197711@gmail.com"}' where id=$1`,[user]);
  assert.equal(await role(user),'user');
  await assert.rejects(as(user,'select public.admin_users()'),/Administrator access required/);
  await assert.rejects(moderate(user,admin,'ban'),/Administrator access required/);
  const users=(await as(admin,'select public.admin_users() as users')).rows[0].users;
  assert.equal(users.length,4); assert.equal(users.find(x=>x.id===owner).role,'administrator');
  const join=async id=>(await db.query('select public.online_join($1,$2,5) as data',[id,'Test'])).rows[0].data;
  await join(user); const game=(await join(admin)).game;
  await db.query('insert into public.player_progress(user_id) values($1)',[user]);
  await moderate(owner,user,'suspend',new Date(Date.now()+3600_000).toISOString());
  assert.equal(await heartbeat(user),'suspended');
  const status=(await as(user,'select public.app_account_status() as status')).rows[0].status;
  assert.equal(status.status,'suspended'); assert.match(status.reason,/Test moderation/);
  const ended=(await db.query('select * from public.online_games where id=$1',[game.id])).rows[0];
  assert.equal(ended.result,ended.white_id===user?'0-1':'1-0'); assert.equal(ended.rated,false);
  assert.equal((await db.query('select * from public.online_seats where game_id=$1',[game.id])).rows.length,0);
  assert.equal((await as(user,'select * from public.online_games')).rows.length,0,'Existing JWTs cannot read tables');
  assert.equal((await as(user,'select * from public.player_progress')).rows.length,0);
  await assert.rejects(as(user,'select public.online_social()'),/restricted/);
  await assert.rejects(as(user,'select public.record_game_result($1,$2,0)',[crypto.randomUUID(),'win']),/restricted/);
  await assert.rejects(as(user,'select public.merge_guest_progress($1,0,0,0,0,0)',[crypto.randomUUID()]),/restricted/);
  await assert.rejects(as(user,'select public.save_player_game($1,0,$2)',[{},user]),/restricted/);
  await assert.rejects(join(user),/restricted/);
  await assert.rejects(db.query('select public.online_commit($1,0,$2,$3)',[game.id,user,'tick']),/restricted/);
  await moderate(admin,user,'restore'); assert.equal(await heartbeat(user),'user');
  await moderate(admin,user,'suspend',new Date(Date.now()+60_000).toISOString());
  await db.query("update auth.users set banned_until=now()-interval '1 second' where id=$1",[user]);
  assert.equal(await heartbeat(user),'user','Suspension expires automatically');
  await moderate(admin,user,'ban'); assert.equal(await heartbeat(user),'banned');
  await assert.rejects(grant(owner,user),/restricted/);
  await moderate(owner,admin,'ban');
  await assert.rejects(as(admin,'select public.admin_statistics()'),/restricted/);
  await assert.rejects(grant(admin,user),/restricted/);
  await moderate(owner,admin,'restore');
  await grant(admin,owner,false); // No hidden owner/super-administrator privilege.
  assert.equal(await role(owner),'user');
  await assert.rejects(grant(owner,user),/Administrator access required/);
  await grant(admin,owner);
  await assert.rejects(moderate(owner,user,'suspend',new Date(Date.now()-1000).toISOString()),/Suspension must end/);
  await assert.rejects(as(owner,'select public.admin_moderate_user($1,$2,$3)',[user,'ban',' ']),/enter a reason/);
  for(const table of ['app_administrators','app_account_restrictions','app_administration_audit']) {
    await assert.rejects(as(owner,`select * from public.${table}`),/permission denied/);
  }
  assert((await db.query('select count(*)::int as n from public.app_administration_audit')).rows[0].n>=10);
  await db.exec('set role anon');
  await assert.rejects(db.query('select public.admin_users()'),/permission denied/);
  await assert.rejects(db.query('select public.admin_moderate_user($1,$2,$3)',[user,'restore','x']),/permission denied/);
  await db.exec('reset role');
  console.log('PASS roles: default user, all-admin management, no metadata/email elevation, ban/suspend/restore/expiry, active-token RLS/RPC/matchmaking enforcement, live forfeits, self-action protection, audit and repeatable migration.');
}catch(error){console.error(error.message, error.where ?? '', error.query ?? ''); process.exitCode=1;}finally{await db.close();}
