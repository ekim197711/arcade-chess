import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from './.tmp/ladder-check/node_modules/@electric-sql/pglite/dist/index.js';

const db = new PGlite();
try {
  await db.exec(`create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,
    is_anonymous boolean default false,created_at timestamptz default now(),raw_user_meta_data jsonb default '{}',banned_until timestamptz);
    create role anon; create role authenticated; create role service_role;
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid() to authenticated;`);
  for (const file of ['schema.sql', 'multiplayer.sql', 'social.sql', 'administration.sql', 'roles.sql', 'multiplayer-transport.sql', 'account-deletion.sql', 'account-deletion.sql']) {
    let sql = await readFile(`supabase/${file}`, 'utf8');
    if (file === 'multiplayer.sql') sql = sql.replace('p_actor is distinct from g.white_id', 'p_actor<>g.white_id');
    await db.exec(sql);
  }
  const commitBody = (await db.query("select prosrc from pg_proc where oid='public.online_commit(uuid,integer,uuid,text,text,text,text,text,text,text)'::regprocedure")).rows[0].prosrc;
  assert.match(commitBody,/account-access-guard/,'migration preserves the moderation guard');
  assert.match(commitBody,/p_actor is distinct from g.white_id/,'migration repairs the existing nullable-player check');
  const [me, other, outsider] = Array.from({ length: 3 }, () => crypto.randomUUID());
  for (const id of [me, other, outsider]) {
    await db.query('insert into auth.users values($1)', [id]);
    await db.query('insert into public.player_progress(user_id) values($1)', [id]);
    await db.query('insert into public.player_progress_events values($1,$2,now())', [id, crypto.randomUUID()]);
    await db.query("insert into public.player_games values($1,'private', '{}',0,now())", [id]);
    await db.query("insert into public.online_players(user_id,display_name) values($1,'Private name')", [id]);
    await db.query('insert into public.online_queue(user_id,minutes) values($1,5)', [id]);
  }
  const addGame = async (white, black, result = null, bot = false) => (await db.query(`
    insert into public.online_games(white_id,black_id,white_name,black_name,white_rating,black_rating,is_bot,minutes,white_ms,black_ms,result,pgn)
    values($1,$2,'Private white','Private black',1200,1200,$4,5,300000,300000,$3,
      '[White "Private white"]\n[Black "Private black"]\n\n1. e4 e5') returning id`, [white,black,result,bot])).rows[0].id;
  const finishedWhite = await addGame(me,other,'1-0');
  const finishedBlack = await addGame(other,me,'0-1');
  const live = await addGame(me,other);
  const practice = await addGame(me,null,null,true);
  const unrelated = await addGame(other,outsider,'1/2-1/2');
  await db.query('insert into public.online_seats values($1,$3),($2,$3)', [me,other,live]);
  const get = async id => (await db.query('select * from public.online_games where id=$1',[id])).rows[0];
  const untouched = await get(unrelated);

  // Anonymous/missing identity cannot delete anyone, and callers cannot supply another ID.
  await db.exec('set role anon');
  await assert.rejects(db.query('select public.delete_own_account()'), /permission denied/);
  await db.exec('reset role; set role authenticated');
  await assert.rejects(db.query('select public.delete_own_account()'), /Authentication required/);
  await assert.rejects(db.query('select public.delete_own_account($1)',[other]));
  await db.exec('reset role');

  // Prove a failure after cleanup begins rolls the entire deletion back.
  await db.exec(`create function public.reject_test_delete() returns trigger language plpgsql as $$
    begin raise exception 'test failure'; end $$;
    create trigger z_test_failure before delete on auth.users for each row execute function public.reject_test_delete();`);
  await db.query("select set_config('test.uid',$1,false)",[me]);
  await db.exec('set role authenticated');
  await assert.rejects(db.query('select public.delete_own_account()'), /test failure/);
  await db.exec('reset role');
  assert.equal((await get(live)).result,null);
  assert.equal((await get(finishedWhite)).white_id,me);
  assert.equal((await db.query('select count(*) as n from public.online_seats')).rows[0].n,2);
  await db.exec('drop trigger z_test_failure on auth.users');

  await db.exec('set role authenticated');
  await db.query('select public.delete_own_account()');
  await db.exec('reset role');
  for (const table of ['auth.users','public.player_progress','public.player_progress_events','public.player_games','public.online_players','public.online_queue','public.online_seats']) {
    const column = table === 'auth.users' ? 'id' : 'user_id';
    assert.equal((await db.query(`select count(*) as n from ${table} where ${column}=$1`,[me])).rows[0].n,0,table);
  }
  const white = await get(finishedWhite), black = await get(finishedBlack);
  assert.equal(white.white_id,null); assert.equal(white.white_name,'Deleted user');
  assert.ok(white.pgn.includes('[White "Deleted user"]'));
  assert.ok(!white.pgn.includes('Private white'));
  assert.equal(white.result,'1-0'); assert.equal(white.black_id,other);
  await assert.rejects(db.query("select public.online_commit($1,0,$2,'inspect')",[finishedWhite,outsider]), /Not a participant/);
  assert.equal(black.black_id,null); assert.equal(black.black_name,'Deleted user');
  assert.ok(black.pgn.includes('[Black "Deleted user"]'));
  assert.ok(!black.pgn.includes('Private black'));
  assert.equal((await get(live)).result,'0-1');
  assert.equal((await get(live)).rated,false);
  assert.equal((await get(live)).reason,'Account deleted');
  assert.equal(await get(practice),undefined);
  assert.equal((await db.query('select count(*) as n from public.online_seats')).rows[0].n,0);
  assert.deepEqual(await get(unrelated),untouched);
  assert.equal((await db.query('select count(*) as n from public.player_progress where user_id=$1',[other])).rows[0].n,1);

  // The surviving opponent can still read their history under RLS.
  await db.query("select set_config('test.uid',$1,false)",[other]);
  await db.exec('set role authenticated');
  assert.equal((await db.query('select * from public.online_games where id=$1',[live])).rows[0].white_name,'Deleted user');
  await db.exec('reset role');
  // Admin deletion uses the same cleanup; matches with both players gone disappear.
  await db.query('delete from auth.users where id=$1',[other]);
  assert.equal(await get(finishedWhite),undefined);
  assert.equal(await get(finishedBlack),undefined);
  assert.equal((await get(unrelated)).white_name,'Deleted user');
  console.log('Account deletion checks passed: access control, atomic rollback, private data erasure, both colors, PGN anonymization, live forfeit, RLS and admin deletion.');
} finally { await db.close(); }
