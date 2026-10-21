import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
// Temporary test dependency: npm install --prefix .tmp/ladder-check --no-package-lock @electric-sql/pglite
import { PGlite } from './.tmp/ladder-check/node_modules/@electric-sql/pglite/dist/index.js';

const db = new PGlite();
const user = crypto.randomUUID();
const v1 = crypto.randomUUID();
const schema = await readFile(new URL('./supabase/schema.sql', import.meta.url), 'utf8');
try {
  await db.exec(`create schema auth;
    create table auth.users (id uuid primary key);
    create role anon; create role authenticated;
    create function auth.uid() returns uuid language sql as $$ select current_setting('test.uid', true)::uuid $$;
    create table public.player_progress (user_id uuid primary key references auth.users(id), progress jsonb not null, updated_at timestamptz not null default now());`);
  await db.query('insert into auth.users values ($1), ($2)', [user, v1]);
  await db.query('insert into public.player_progress(user_id, progress) values ($1, $2), ($3, $4)', [
    user, { wins: 5, losses: 2, streak: 0, bestStreak: 3, bossesDefeated: 1, progressionVersion: 2 },
    v1, { wins: 3, bossesDefeated: 3, progressionVersion: 1 },
  ]);
  await db.exec(schema);
  await db.query("select set_config('test.uid', $1, false)", [user]);
  const read = async () => (await db.query('select progress from public.player_progress where user_id = $1', [user])).rows[0].progress;
  assert.equal((await read()).bossesDefeated, 1);
  assert.equal((await read()).freestyleBossesDefeated, 0);
  assert.equal((await db.query('select progress from public.player_progress where user_id = $1', [v1])).rows[0].progress.bossesDefeated, 20);
  const result = async (id, mode, index, outcome = 'win') => (await db.query('select public.record_game_result($1::uuid, $2, $3, $4) as progress', [id, outcome, index, mode])).rows[0].progress;
  for (const mode of ['standard', 'freestyle']) for (const index of [0, 1, 57, 58]) {
    const before = await read();
    const id = crypto.randomUUID();
    const saved = await result(id, mode, index);
    const field = mode === 'standard' ? 'bossesDefeated' : 'freestyleBossesDefeated';
    const other = mode === 'standard' ? 'freestyleBossesDefeated' : 'bossesDefeated';
    assert.equal(saved[field], Math.max(before[field], index + 1));
    assert.equal(saved[other], before[other]);
    assert.deepEqual(await result(id, mode, index), saved);
  }
  const before = await read();
  const loss = await result(crypto.randomUUID(), 'freestyle', 58, 'loss');
  assert.equal(loss.bossesDefeated, before.bossesDefeated);
  assert.equal(loss.freestyleBossesDefeated, before.freestyleBossesDefeated);
  const mergeId = crypto.randomUUID();
  const merge = async () => (await db.query('select public.merge_guest_progress($1::uuid, 2, 1, 1, 2, 1, 58) as progress', [mergeId])).rows[0].progress;
  const merged = await merge();
  assert.equal(merged.wins, loss.wins + 2);
  assert.equal(merged.bossesDefeated, 59);
  assert.equal(merged.freestyleBossesDefeated, 59);
  assert.deepEqual(await merge(), merged);
  await db.query("select set_config('test.uid', $1, false)", [v1]);
  const separateMerge = (standard, freestyle) => db.query('select public.merge_guest_progress($1::uuid, 0, 0, 0, 0, $2, $3) as progress', [crypto.randomUUID(), standard, freestyle]);
  assert.deepEqual((await separateMerge(1, 58)).rows[0].progress, { wins: 3, losses: 0, streak: 0, bestStreak: 0, bossesDefeated: 20, freestyleBossesDefeated: 58, progressionVersion: 3 });
  const secondMerge = (await separateMerge(58, 1)).rows[0].progress;
  assert.equal(secondMerge.bossesDefeated, 58);
  assert.equal(secondMerge.freestyleBossesDefeated, 58);
  await db.query("select set_config('test.uid', $1, false)", [user]);
  const invalidId = crypto.randomUUID();
  await assert.rejects(result(invalidId, 'invalid', 0));
  await result(invalidId, 'freestyle', 0); // rejected RPC must not consume its event ID
  await assert.rejects(db.query('select public.merge_guest_progress($1::uuid, 0, 0, 0, 0, 0, 60)', [crypto.randomUUID()]));
  // Reapplying the migration must preserve both ladders and allow legacy default-mode callers.
  const final = await read();
  await db.exec(schema);
  assert.deepEqual(await read(), final);
  await db.query("select public.record_game_result($1::uuid, 'win', 0)", [crypto.randomUUID()]);
  await db.query('select public.merge_guest_progress($1::uuid, 0, 0, 0, 0, 0)', [crypto.randomUUID()]);
  assert.equal((await read()).freestyleBossesDefeated, 59);
  console.log('PASS real PostgreSQL schema/migrations, independent RPC results, guest merge, event idempotency, invalid inputs, reapplying schema, legacy callers');
} finally { await db.close(); }
