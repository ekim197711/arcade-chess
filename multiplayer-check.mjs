import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from './.tmp/ladder-check/node_modules/@electric-sql/pglite/dist/index.js';
import { createServer } from 'vite';
const db = new PGlite();
const vite = await createServer({ resolve: { alias: { 'npm:chess.js@1.4.0': 'chess.js' } }, server: { watch: null } });
try {
  const { clockRemaining, formatClock, reconnectDeadline, predictOnlineMove, predictionWasSaved } = await vite.ssrLoadModule('/src/onlineChess.ts');
  const { replay, outcome, timeoutResult, botMove, botThinkDelayMs, botReadyToMove } = await vite.ssrLoadModule('/supabase/functions/multiplayer/rules.ts');
  await db.exec(`create schema auth; create table auth.users(id uuid primary key); create role anon; create role authenticated; create role service_role;
    create function auth.uid() returns uuid language sql as $$ select current_setting('test.uid',true)::uuid $$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
  const sql = await readFile('supabase/multiplayer.sql','utf8');
  await db.exec(sql); await db.exec(sql); // Repeatable migration.
  const people = Array.from({length: 12},() => crypto.randomUUID());
  for (const id of people) await db.query('insert into auth.users values($1)',[id]);
  const join = async (id,minutes=5,cancel=false) => (await db.query('select public.online_join($1,$2,$3,$4) as data',[id,'Test player',minutes,cancel])).rows[0].data;
  const commit = async (g,actor,kind,extra={}) => (await db.query('select public.online_commit($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) as data',[
    g.id,g.version,actor,kind,extra.pgn ?? null,extra.fen ?? null,extra.turn ?? null,extra.result ?? null,extra.reason ?? '',extra.timeout ?? '0-1',
  ])).rows[0].data;
  const move = async (g,san) => {
    const position = replay(g.pgn); position.move(san); const end = outcome(position);
    return commit(g,g.turn==='w' ? g.white_id : g.black_id,'move',{pgn:position.pgn(),fen:position.fen(),turn:position.turn(),...end});
  };
  const expected = async (a,b) => (await db.query('select public.online_expected($1,$2) as p',[a,b])).rows[0].p;
  assert.equal(Number(await expected(1200,1200)),.5);
  assert.equal(Number(await expected(1600,1200)),.92);
  assert.equal(Number(await expected(1800,1200)),.92);
  assert.equal(Number(await expected(1200,1600)),.08);
  for (const minutes of [3,5,10,15]) { assert.equal((await join(people[0],minutes)).queued,true); await join(people[0],minutes,true); }
  await assert.rejects(join(people[0],7));
  // Same time control and nearest available Elo, independent of arrival order.
  await join(people[0]); await join(people[1],3); await join(people[2],10);
  await db.query('update public.online_players set rating=1600 where user_id=$1',[people[0]]);
  await db.query('insert into public.online_players(user_id,display_name,rating) values($1,$2,$3)',[people[3],'Nearest',1220]);
  await db.query('insert into public.online_queue(user_id,minutes) values($1,5)',[people[3]]);
  let g = (await join(people[4])).game;
  assert.ok([g.white_id,g.black_id].includes(people[3]));
  assert.equal((await join(people[4],15)).game.id,g.id); // Rejoin cannot create a second match.
  assert.equal((await join(people[4],5,true)).game.id,g.id); // Cancellation race returns matched game.
  assert.equal((await db.query('select count(*) as n from public.online_seats where game_id=$1',[g.id])).rows[0].n,2);
  await assert.rejects(commit(g,people[8],'resign'));
  await assert.rejects(commit(g,null,'move'));
  await assert.rejects(commit(g,g.black_id,'move',{pgn:'1. e4',fen:'x',turn:'b'}));
  const stale = g;
  await db.query("update public.online_games set turn_started_at=clock_timestamp()-interval '3 seconds' where id=$1",[g.id]);
  g = await commit(g,g.white_id,'tick');
  g = await move(g,'f3');
  assert.equal(g.move_times_ms.length,1);
  assert.ok(g.move_times_ms[0]>=3000 && g.move_times_ms[0]<10000,'server records elapsed turn time, including across heartbeats');
  assert.deepEqual(await commit(stale,stale.white_id,'resign'),g); // Optimistic versions reject stale requests.
  g = await move(g,'e5'); g = await move(g,'g4'); g = await move(g,'Qh4#');
  assert.equal(g.move_times_ms.length,4,'one measurement per committed move');
  assert.equal(g.result,'0-1'); assert.equal(g.reason,'Checkmate'); assert.equal(g.rated,true);
  const before = (await db.query('select * from public.online_players order by user_id')).rows;
  await commit(g,g.white_id,'resign');
  assert.deepEqual((await db.query('select * from public.online_players order by user_id')).rows,before);
  assert.equal(g.white_delta,-g.black_delta);
  // RLS: unrelated live games hidden, finished games shared, direct writes/RPCs forbidden.
  await db.query("select set_config('test.uid',$1,false)",[people[9]]);
  await db.exec('set role authenticated');
  assert.equal((await db.query('select * from public.online_games')).rows.length,1);
  await assert.rejects(db.query('update public.online_players set rating=9999'));
  await assert.rejects(join(people[9]));
  await assert.rejects(commit(g,people[9],'resign'));
  await db.exec('reset role');
  // Expired queue entries cannot be paired; fallback is server-timed and unrated.
  await db.query("update public.online_queue set last_seen=clock_timestamp()-interval '30 seconds' where user_id=$1",[people[0]]);
  assert.equal((await join(people[5])).queued,true);
  await db.query("update public.online_queue set queued_at=clock_timestamp()-interval '21 seconds' where user_id=$1",[people[5]]);
  let bot = (await join(people[5])).game;
  assert.equal(bot.is_bot,true); assert.equal(bot.white_ms,300000);
  bot=await move(bot,'e4');
  await db.query("update public.online_games set move_times_ms='[]'::jsonb where id=$1",[bot.id]);
  const thinkDelay = botThinkDelayMs(bot), turnStart = Date.parse(bot.turn_started_at);
  assert.ok(thinkDelay >= 1000 && thinkDelay <= 5000);
  assert.equal(botReadyToMove(bot,turnStart),false);
  assert.equal(botReadyToMove(bot,turnStart+thinkDelay-1),false);
  assert.equal(botReadyToMove(bot,turnStart+thinkDelay),true);
  assert.equal(botReadyToMove({...bot,is_bot:false},turnStart+10000),false);
  assert.equal(botReadyToMove({...bot,turn:'w'},turnStart+10000),false);
  assert.equal(botReadyToMove({...bot,result:'0-1'},turnStart+10000),false);
  assert.equal(botThinkDelayMs({...bot,version:bot.version+1}),thinkDelay,'heartbeats and other requests cannot reroll the delay');
  bot=await commit(bot,bot.white_id,'tick');
  assert.equal(Date.parse(bot.turn_started_at),turnStart,'heartbeats do not restart the thinking timer');
  assert.equal(botReadyToMove(bot,turnStart+thinkDelay),true);
  const delays = new Set(Array.from({length:100},(_,index) => botThinkDelayMs({...bot,ply_count:1+index*2})));
  assert.deepEqual([...delays].sort((a,b)=>a-b),[1000,2000,3000,4000,5000]);
  const botPosition=replay(bot.pgn); const reply=botMove(botPosition,bot.black_rating); assert.ok(reply);
  for (const rating of [100,3000]) assert.ok(botPosition.moves().includes(botMove(botPosition,rating).san));
  bot=await move(bot,reply.san);
  assert.equal(bot.move_times_ms[0],null,'legacy move times remain unknown');
  assert.ok(Number.isFinite(bot.move_times_ms[1]),'new move is aligned after legacy plies');
  bot=await commit(bot,bot.white_id,'resign'); assert.equal(bot.rated,false); assert.equal(bot.white_delta,0);
  // Equal rating, established K and persistent 2400 peak; agreed draws.
  await join(people[6],15); let draw=(await join(people[7],15)).game;
  draw=await move(draw,'e4'); draw=await move(draw,'e5');
  draw=await commit(draw,draw.white_id,'offer_draw');
  await assert.rejects(commit(draw,draw.white_id,'accept_draw'));
  draw=await commit(draw,draw.black_id,'accept_draw'); assert.equal(draw.result,'1/2-1/2'); assert.equal(draw.white_delta,0); assert.equal(draw.black_delta,0);
  await join(people[6],15); let rated=(await join(people[7],15)).game;
  await db.query('update public.online_players set rated_games=30,peak_rating=2400 where user_id=$1',[rated.white_id]);
  await db.query('update public.online_players set rated_games=30 where user_id=$1',[rated.black_id]);
  rated=await move(rated,'e4'); rated=await move(rated,'e5'); rated=await commit(rated,rated.black_id,'resign');
  assert.equal(rated.white_delta,5); assert.equal(rated.black_delta,-10);
  // Server clock overrides a late move, and final clocks stop.
  await join(people[6],15); let flag=(await join(people[7],15)).game;
  await db.query("update public.online_games set turn_started_at=clock_timestamp()-interval '16 minutes' where id=$1",[flag.id]);
  flag=await move(flag,'e4'); assert.equal(flag.reason,'Time expired'); assert.equal(flag.ply_count,0); assert.equal(flag.rated,false);
  assert.equal(clockRemaining(flag,'w',Date.now()+99999999),0);
  const live={...flag,result:null,white_ms:180000,turn:'w',turn_started_at:new Date(10000).toISOString()};
  assert.equal(clockRemaining(live,'w',11000),179000); assert.equal(clockRemaining(live,'b',11000),flag.black_ms);
  assert.equal(formatClock(180000),'3:00'); assert.equal(formatClock(1),'0:01'); assert.equal(formatClock(-1),'0:00');
  assert.equal(timeoutResult(replay('[SetUp "1"]\n[FEN "7k/8/8/8/8/8/P7/K7 w - - 0 1"]')),'1/2-1/2');
  assert.equal(outcome(replay('1. f3 e5 2. g4 Qh4#')).result,'0-1');
  // Presence does not change move versions, so polling cannot invalidate a move.
  await join(people[6],15); let reconnect=(await join(people[7],15)).game;
  const initialVersion=reconnect.version;
  const seenBeforeInspect=reconnect.white_seen_at;
  reconnect=await commit(reconnect,reconnect.white_id,'inspect');
  assert.equal(reconnect.white_seen_at,seenBeforeInspect); assert.equal(reconnect.version,initialVersion);
  const predicted=predictOnlineMove(reconnect,{from:'e2',to:'e4'},Date.now());
  assert.equal(predicted.game.turn,'b'); assert.equal(predicted.game.ply_count,reconnect.ply_count+1);
  assert.equal(reconnect.ply_count,0); assert.equal(predicted.game.result,null);
  reconnect=await commit(reconnect,reconnect.white_id,'tick'); assert.equal(reconnect.version,initialVersion);
  reconnect=await move(reconnect,'e4'); assert.equal(predictionWasSaved(predicted,reconnect),true);
  reconnect=await move(reconnect,'e5'); assert.equal(predictionWasSaved(predicted,reconnect),true);
  reconnect=await commit(reconnect,reconnect.white_id,'disconnect');
  const disconnectStamp=reconnect.white_disconnected_at;
  assert.ok(disconnectStamp);
  reconnect=await commit(reconnect,reconnect.white_id,'disconnect'); assert.equal(reconnect.white_disconnected_at,disconnectStamp);
  assert.equal(reconnectDeadline(reconnect,'w'),Date.parse(disconnectStamp)+20000);
  await db.query("update public.online_games set white_disconnected_at=clock_timestamp()-interval '19 seconds' where id=$1",[reconnect.id]);
  reconnect=await commit(reconnect,reconnect.white_id,'tick'); assert.equal(reconnect.result,null); assert.equal(reconnect.white_disconnected_at,null);
  // A returning player's own heartbeat cannot clear an already expired deadline.
  await db.query("update public.online_games set white_disconnected_at=clock_timestamp()-interval '21 seconds' where id=$1",[reconnect.id]);
  reconnect=await commit(reconnect,reconnect.white_id,'tick'); assert.equal(reconnect.result,'0-1'); assert.equal(reconnect.rated,true);
  assert.match(reconnect.reason,/20-second reconnect window expired/);
  assert.ok(reconnect.white_delta<0); assert.ok(reconnect.black_delta>0);
  assert.equal(reconnectDeadline(reconnect,'w'),null);
  const ratedOnce=(await db.query('select * from public.online_players order by user_id')).rows;
  await commit(reconnect,reconnect.white_id,'tick');
  assert.deepEqual((await db.query('select * from public.online_players order by user_id')).rows,ratedOnce);
  // Abrupt kills (no close event) use the last heartbeat; bot games stay unrated.
  await db.query('delete from public.online_queue');
  await join(people[8],10);
  await db.query("update public.online_queue set queued_at=clock_timestamp()-interval '21 seconds' where user_id=$1",[people[8]]);
  let abandonedBot=(await join(people[8],10)).game;
  assert.equal(reconnectDeadline(abandonedBot,'b'),null);
  await db.query("update public.online_games set white_seen_at=clock_timestamp()-interval '21 seconds' where id=$1",[abandonedBot.id]);
  abandonedBot=await commit(abandonedBot,abandonedBot.white_id,'inspect');
  assert.equal(abandonedBot.result,'0-1'); assert.equal(abandonedBot.rated,false);
  // Clock expiry before the reconnect deadline takes precedence.
  await join(people[6],15); let clockFirst=(await join(people[7],15)).game;
  await db.query("update public.online_games set white_disconnected_at=clock_timestamp()-interval '21 seconds', turn_started_at=clock_timestamp()-interval '16 minutes' where id=$1",[clockFirst.id]);
  clockFirst=await commit(clockFirst,clockFirst.white_id,'tick'); assert.equal(clockFirst.reason,'Time expired');
  console.log('PASS multiplayer: nearest-Elo pairing, all clocks, cancellation, stale queues, bot fallback, stable 1-5 second thinking delays, legal low/high bot moves, turn ownership, version conflicts, atomic/idempotent ratings, draw, timeout, RLS, shared history');
} finally { await db.close(); await vite.close(); }
