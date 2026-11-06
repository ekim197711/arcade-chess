import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from './.tmp/ladder-check/node_modules/@electric-sql/pglite/dist/index.js';

const db = new PGlite();
try {
  await db.exec(`create schema auth;
    create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz,
      is_anonymous boolean default false, created_at timestamptz default now(), raw_user_meta_data jsonb default '{}');
    create role anon; create role authenticated; create role service_role;
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid() to authenticated;`);
  for (const file of ['schema.sql', 'multiplayer.sql', 'account-deletion.sql', 'administration.sql', 'administration.sql']) {
    await db.exec(await readFile(`supabase/${file}`, 'utf8'));
  }
  const [owner, player, other, unverified, anonymous] = Array.from({ length: 5 }, () => crypto.randomUUID());
  for (const [id, email, verified, anon] of [[owner, 'EKIM197711@gmail.com', true, false], [player, 'player@example.com', true, false], [other, 'other@example.com', true, false], [unverified, 'unverified@example.com', false, false], [anonymous, null, false, true]]) {
    await db.query(`insert into auth.users(id,email,email_confirmed_at,is_anonymous) values($1,$2,case when $3 then now() end,$4)`, [id,email,verified,anon]);
  }
  const as = async (id, sql, params = []) => {
    await db.exec('reset role');
    await db.query("select set_config('test.uid',$1,false)", [id ?? '']);
    await db.exec('set role authenticated');
    try { return await db.query(sql, params); } finally { await db.exec('reset role'); }
  };
  const role = async id => (await as(id, 'select public.app_role() as role')).rows[0].role;
  const stats = async id => (await as(id, 'select public.admin_statistics() as stats')).rows[0].stats;
  assert.equal(await role(owner), 'super_administrator');
  assert.equal(await role(player), 'player');
  assert.equal(await role(anonymous), null);
  await db.exec('set role anon');
  for (const fn of ['app_role()', 'app_heartbeat()', 'admin_statistics()', 'admin_users()', `admin_set_administrator('${player}',true)`]) {
    await assert.rejects(db.query(`select public.${fn}`), /permission denied/);
  }
  await db.exec('reset role');
  await assert.rejects(as(null, 'select public.app_heartbeat()'), /Authentication required/);
  await assert.rejects(as(anonymous, 'select public.app_heartbeat()'), /Authentication required/);
  for (const fn of ['admin_statistics()', 'admin_users()', `admin_set_administrator('${player}',true)`]) {
    await assert.rejects(as(player, `select public.${fn}`), /access required/);
  }
  // Editable metadata cannot elevate the user, and table writes cannot bypass RPCs.
  await db.query(`update auth.users set raw_user_meta_data='{"role":"super_administrator","email":"ekim197711@gmail.com"}' where id=$1`,[player]);
  assert.equal(await role(player), 'player');
  for (const table of ['app_administrators','app_presence','app_completed_games']) {
    await assert.rejects(as(player, `select * from public.${table}`), /permission denied/);
    await assert.rejects(as(owner, `delete from public.${table}`), /permission denied/);
  }
  await as(owner, 'select public.admin_set_administrator($1,true)', [player]);
  await as(owner, 'select public.admin_set_administrator($1,true)', [player]);
  assert.equal(await role(player), 'administrator');
  await assert.rejects(as(player,'select public.admin_users()'), /Super administrator access required/);
  await assert.rejects(as(player,'select public.admin_set_administrator($1,true)',[other]), /Super administrator access required/);
  await assert.rejects(as(owner,'select public.admin_set_administrator($1,false)',[owner]), /cannot be changed/);
  await assert.rejects(as(owner,'select public.admin_set_administrator($1,true)',[unverified]), /verify their email/);
  await db.query('update auth.users set email_confirmed_at=null where id=$1', [owner]);
  assert.equal(await role(owner),'player', 'Unverified owner email must not be privileged');
  await db.query('update auth.users set email_confirmed_at=now() where id=$1', [owner]);
  assert.equal((await as(owner,'select public.admin_users($1,0) as users',['PLAYER@'])).rows[0].users.length,1);
  assert.equal((await as(owner,'select public.admin_users($1,0) as users',['%'])).rows[0].users.length,0,'Search characters are literal');
  await assert.rejects(as(owner,'select public.admin_users($1,-1)',['']), /Invalid search/);
  for (const id of [owner, player, player, other]) await as(id,'select public.app_heartbeat()');
  await db.query("update public.app_presence set last_seen=now()-interval '91 seconds' where user_id=$1",[other]);
  assert.equal((await stats(player)).users,4);
  assert.equal((await stats(player)).online,2,'Multiple tabs count once; expired presence excluded');

  const archive = (id, result, debug = false) => ({ id, result, debug, updatedAt: new Date().toISOString() });
  for (const game of [archive('completed','win'), archive('unfinished','unfinished'), archive('debug','win',true)]) {
    await db.query('insert into public.player_games(user_id,id,game,ply_count) values($1,$2,$3,0)',[owner, game.id, game]);
  }
  await db.query(`update public.player_games set game=game || '{"reason":"retried"}' where id='completed'`);
  await db.query(`update public.player_games set game=game || jsonb_build_object('result','draw','updatedAt',now()) where id='unfinished'`);
  const online = await db.query(`insert into public.online_games(white_id,black_id,white_name,black_name,white_rating,black_rating,minutes,white_ms,black_ms,result,finished_at)
    values($1,$2,'One','Two',1200,1200,5,300000,300000,'1-0',now()) returning id`,[owner,player]);
  await db.query('update public.online_games set reason=$1 where id=$2',['retry', online.rows[0].id]);
  assert.equal((await stats(owner)).games.hour,3,'Completed boss, draw and two-player match count once; debug/unfinished excluded');
  // Older completions exercise all rolling windows, including exclusion of future timestamps.
  await db.exec(`insert into public.app_completed_games values
    ('2h',now()-interval '2 hours'),('2d',now()-interval '2 days'),('8d',now()-interval '8 days'),
    ('31d',now()-interval '31 days'),('future',now()+interval '1 day');`);
  const totals = (await stats(owner)).games;
  assert.equal(totals.hour,3); assert.equal(totals.week,5); assert.equal(totals.month,6);
  const today = (await db.query(`select count(*)::int as n from public.app_completed_games
    where completed_at >= ((now() at time zone 'Europe/Copenhagen')::date at time zone 'Europe/Copenhagen') and completed_at <= now()`)).rows[0].n;
  assert.equal(totals.today,today,'Today uses the Copenhagen calendar boundary');
  await db.exec(await readFile('supabase/administration.sql','utf8'));
  assert.deepEqual((await stats(owner)).games,totals,'Migration backfill is idempotent');
  await as(owner,'select public.admin_set_administrator($1,false)',[player]);
  assert.equal(await role(player),'player');
  await assert.rejects(stats(player),/Administrator access required/);
  await as(owner,'select public.delete_own_account()');
  assert.equal((await db.query('select count(*)::int as n from public.app_presence where user_id=$1',[owner])).rows[0].n,0);
  assert.equal((await db.query('select count(*)::int as n from public.app_completed_games')).rows[0].n,8,'Aggregate game history survives account deletion');
  console.log('PASS administration: verified owner, grants/revocation, metadata spoofing, RPC and table access, search, presence expiry/deduplication, completion deduplication, time windows, backfill and deletion.');
} finally { await db.close(); }
