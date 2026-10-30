import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from './.tmp/ladder-check/node_modules/@electric-sql/pglite/dist/index.js';

const db = new PGlite();
try {
  await db.exec(`create schema auth; create table auth.users(id uuid primary key);
    create role anon; create role authenticated; create role service_role;
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;`);
  await db.exec(await readFile('supabase/multiplayer.sql', 'utf8'));
  const migration = await readFile('supabase/social.sql', 'utf8');
  await db.exec(migration); await db.exec(migration);
  const [a,b,c] = Array.from({ length: 3 }, () => crypto.randomUUID());
  for (const id of [a,b,c]) await db.query('insert into auth.users values($1)', [id]);
  const join = async id => (await db.query('select public.online_join($1,$2,5) as data', [id, id === a ? 'Alice' : 'Bob'])).rows[0].data;
  await join(a); const game = (await join(b)).game;
  const call = async (id, action = 'state', peer = null, body = null, enabled = null, gameId = null) => {
    await db.query("select set_config('test.uid',$1,false)", [id ?? '']);
    await db.exec('set role authenticated');
    try { return (await db.query('select public.online_social($1,$2,$3,$4,$5) as data', [action,gameId,peer,body,enabled])).rows[0].data; }
    finally { await db.exec('reset role'); }
  };
  const inGame = (id, action = 'state', body = null) => call(id, action, null, body, null, game.id);
  await assert.rejects(call(null));
  await assert.rejects(inGame(c));
  await assert.rejects(call(a,'request',b));
  await assert.rejects(inGame(a,'chat','hello'));
  await assert.rejects(inGame(a,'emoji','not an emoji'));
  let state = await inGame(a,'request');
  assert.equal(state.friends[0].accepted,false);
  assert.equal(state.friends[0].requested_by,a);
  await inGame(a,'request'); // Retry is idempotent.
  await assert.rejects(inGame(a,'accept'));
  await assert.rejects(call(c,'accept',a));
  state = await call(b,'accept',a);
  assert.equal(state.friends[0].accepted,true);
  state = await inGame(a,'chat','Hello <script>alert(1)</script>');
  assert.equal(state.messages[0].body,'Hello <script>alert(1)</script>');
  assert.equal((await call(b,'state',a)).messages.length,1);
  assert.equal((await call(c,'state',a)).messages.length,0);
  assert.equal((await call(c)).friends.length,0);
  await assert.rejects(inGame(a,'chat','too fast'));
  await assert.rejects(inGame(b,'chat',' '.repeat(10)));
  await assert.rejects(inGame(b,'chat','x'.repeat(501)));
  state = await inGame(a,'emoji','👍');
  assert.equal(state.reactions[0].body,'👍');
  await assert.rejects(inGame(a,'emoji','😮'));
  await call(b,'preferences',null,null,false);
  assert.equal((await inGame(b)).reactions.length,0);
  assert.equal((await call(b)).emojis_enabled,false);
  await assert.rejects(inGame(a,'emoji','😮'));
  await call(b,'preferences',null,null,true);
  await db.exec("update public.online_social_messages set created_at=clock_timestamp()-interval '10 seconds'");
  assert.equal((await inGame(a)).reactions.length,0);
  await inGame(b,'emoji','😠');
  await call(b,'remove',a);
  assert.equal((await inGame(a)).friends.length,0);
  await assert.rejects(inGame(a,'chat','still friends?'));
  assert.equal((await db.query("select * from public.online_social_messages where kind='chat'")).rows.length,0);
  await inGame(a,'request'); await inGame(b,'remove'); // Decline.
  assert.equal((await inGame(a)).friends.length,0);
  await db.exec('set role authenticated');
  for (const table of ['online_friendships','online_social_messages','online_social_preferences']) {
    await assert.rejects(db.query(`select * from public.${table}`));
    await assert.rejects(db.query(`delete from public.${table}`));
  }
  await db.exec('reset role');
  await db.query('update public.online_games set result=$1 where id=$2',['1-0',game.id]);
  await inGame(a,'request'); await inGame(b,'accept'); // Can connect after a match.
  await db.query('delete from auth.users where id=$1',[a]);
  assert.equal((await call(b)).friends.length,0);
  console.log('Social checks passed: mutual friendship, private chat, participant-only reactions, mute persistence, rate limits, removal, account deletion, permissions, repeatable migration.');
} finally { await db.close(); }
