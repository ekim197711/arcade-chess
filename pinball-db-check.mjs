import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from './.tmp/ladder-check/node_modules/@electric-sql/pglite/dist/index.js';
const db=new PGlite();
try{
 await db.exec(`create schema auth;create table auth.users(id uuid primary key);create role anon;create role authenticated;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;`);
 const sql=await readFile('supabase/pinball.sql','utf8');await db.exec(sql);await db.exec(sql);
 const a='00000000-0000-0000-0000-000000000001',b='00000000-0000-0000-0000-000000000002';await db.query('insert into auth.users values($1),($2)',[a,b]);
 await db.exec('set role anon');await assert.rejects(db.query("select public.save_pinball_score(100,'A')"),/permission denied/);
 assert.deepEqual((await db.query('select public.pinball_leaderboard() as board')).rows[0].board,{entries:[],personal:null});
 await db.exec('reset role;set role authenticated');await assert.rejects(db.query("select public.save_pinball_score(100,'A')"),/Sign in required/);
 await db.query("select set_config('test.uid',$1,false)",[a]);
 for(const score of [100,500,200])await db.query("select public.save_pinball_score($1,'Nova')",[score]);
 for(const [score,name] of [[-1,'a'],[2000000001,'a'],[10,''],[10,'x'.repeat(25)]])await assert.rejects(db.query('select public.save_pinball_score($1,$2)',[score,name]),/Invalid/);
 await assert.rejects(db.query('select * from public.pinball_scores'),/permission denied/);
 await db.query("select set_config('test.uid',$1,false)",[b]);await db.query("select public.save_pinball_score(750,'Rook')");
 const board=(await db.query('select public.pinball_leaderboard() as board')).rows[0].board;assert.equal(board.personal.rank,1);assert.equal(board.entries[1].score,500);assert(!('user_id' in board.entries[0]));
 await db.exec('reset role');await db.query('delete from auth.users where id=$1',[b]);assert.equal((await db.query('select * from public.pinball_scores')).rows.length,1);
 console.log('PASS public ranked leaderboard, authenticated best-only updates, private IDs, validation, account isolation and deletion.');
}finally{await db.close();}
