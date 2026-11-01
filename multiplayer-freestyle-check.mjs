import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from './.tmp/ladder-check/node_modules/@electric-sql/pglite/dist/index.js';
import { createServer } from 'vite';
const db = new PGlite();
const vite = await createServer({ server: { watch: null } });
try {
  const { Chess, freestyleFen } = await vite.ssrLoadModule('/src/chess.ts');
  const { replay, outcome, botMove } = await vite.ssrLoadModule('/supabase/functions/multiplayer/rules.ts');
  const { predictOnlineMove, predictionWasSaved } = await vite.ssrLoadModule('/src/onlineChess.ts');
  await db.exec(`create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false,created_at timestamptz default now(),raw_user_meta_data jsonb default '{}',banned_until timestamptz);
    create role anon; create role authenticated; create role service_role;
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
  for (const file of ['schema','multiplayer','social','administration','roles','multiplayer-transport','multiplayer-freestyle','multiplayer-freestyle']) await db.exec(await readFile(`supabase/${file}.sql`,'utf8'));
  const setups = await db.query('select i,public.online_freestyle_fen(i) as fen from generate_series(0,959) i');
  for (const { i, fen } of setups.rows) assert.equal(fen+' chess960',freestyleFen(i),`server setup ${i} matches browser`);
  const people = Array.from({length:8},()=>crypto.randomUUID());
  for (const id of people) await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[id,id+'@example.com']);
  const as = async (id,sql,args=[]) => {await db.query("select set_config('test.uid',$1,false)",[id??'']);await db.exec('set role authenticated');try{return(await db.query(sql,args)).rows[0]?.data;}finally{await db.exec('reset role');}};
  const join=(id,mode='standard',minutes=5,cancel=false)=>as(id,'select public.online_matchmake($1,$2,$3) as data',[minutes,cancel,mode]);
  assert.equal((await join(people[0])).queued,true);
  assert.equal((await join(people[1],'freestyle')).queued,true,'same clock, different variants stay separate');
  const standard=(await as(people[2],'select public.online_matchmake(5,false) as data')).game;
  assert.equal(standard.mode,'standard');assert([standard.white_id,standard.black_id].includes(people[0]));
  let game=(await join(people[3],'freestyle')).game;
  assert.equal(game.mode,'freestyle');assert.equal(replay(game.pgn).mode,'freestyle');assert.equal(replay(game.pgn).fen(),new Chess(game.fen).fen());
  assert.equal((await join(people[1],'standard',3)).game.id,game.id,'existing game always resumes');
  const board=replay(game.pgn);const move=board.moves({verbose:true})[0];
  const predicted=predictOnlineMove(game,move,Date.now());board.move(move);
  game=(await db.query('select public.online_commit($1,$2,$3,\'move\',$4,$5,$6,$7,$8,\'0-1\') as data',[game.id,game.version,game.white_id,board.pgn(),board.fen(),board.turn(),outcome(board).result,outcome(board).reason])).rows[0].data;
  assert(predictionWasSaved(predicted,game));assert.equal(replay(game.pgn).fen(),board.fen());
  assert.throws(()=>replay(game.pgn).move({from:'a1',to:'a8'}));
  await join(people[4],'freestyle',3);
  await db.query("update public.online_queue set queued_at=clock_timestamp()-interval '21 seconds' where user_id=$1",[people[4]]);
  const bot=(await join(people[4],'freestyle',3)).game;
  assert(bot.is_bot);assert.equal(bot.mode,'freestyle');const practice=replay(bot.pgn);practice.move(practice.moves()[0]);assert(botMove(practice,1200));
  await join(people[5],'freestyle');await db.query("update public.online_queue set queued_at=clock_timestamp()-interval '21 seconds' where user_id=$1",[people[5]]);
  assert.equal((await join(people[5],'standard')).queued,true,'changing variants resets fallback countdown');
  assert.equal((await join(people[5],'standard',5,true)).queued,false);
  await assert.rejects(join(people[6],'other'));await assert.rejects(join(people[6],'freestyle',7));await assert.rejects(join(null,'freestyle'));
  await assert.rejects(as(people[6],"select public.online_join_variant($1,'Impersonated',5,false,'freestyle') as data",[people[7]]),/permission denied/);
  await db.query("update auth.users set banned_until=now()+interval '1 day' where id=$1",[people[6]]);await assert.rejects(join(people[6],'freestyle'),/restricted/);
  for(const fen of ['4k3/8/8/8/8/8/8/RK5R w HA - 0 1 chess960','4k3/8/8/8/8/8/8/R4KR1 w GA - 0 1 chess960']) {
    const position=new Chess(fen);const castle=position.moves({verbose:true}).find(m=>m.isKingsideCastle());assert(castle);const server=replay(position.pgn());server.move(castle);position.move(castle);assert.equal(server.fen(),position.fen());assert.equal(replay(server.pgn()).fen(),server.fen());
  }
  console.log('PASS: all 960 setups, repeatable migration, isolated queues, legacy clients, resume, server move commit, optimistic reconciliation, Freestyle bot fallback, cancellation, clock reset, permissions and Chess960 castling.');
} finally { await db.close(); await vite.close(); }
