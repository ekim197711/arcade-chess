import assert from 'node:assert/strict';
import {Chess} from 'chess.js';
import {ASTROID_BOSSES,ASTROID_PUZZLES,startAstroidRun,attemptAstroidMove,expireAstroidRun,nextAstroidTrap,normalizeAstroidClears,astroidStorageKey} from './src/astroidRules.ts';
assert.equal(ASTROID_PUZZLES.length,ASTROID_BOSSES.length*3);
assert.equal(new Set(ASTROID_PUZZLES.map(trap=>trap.fen)).size,18);
for(const trap of ASTROID_PUZZLES){
 const board=new Chess();board.loadPgn(trap.setupPgn);assert.equal(board.fen(),trap.fen);assert.equal(board.turn(),trap.side);
 assert(!board.isGameOver());assert(trap.source.startsWith('https://'));
 const mates=board.moves({verbose:true}).filter(move=>{const trial=new Chess(board.fen());trial.move(move);return trial.isCheckmate();});
 assert(mates.length>0);assert.equal(mates.length,trap.solutions.length);
 for(const solution of trap.solutions){const trial=new Chess(trap.fen);trial.move(solution);assert(trial.isCheckmate());}
}
assert.throws(()=>startAstroidRun(1,0,0));assert.throws(()=>startAstroidRun(-1,0,0));assert.throws(()=>startAstroidRun(6,6,0));
for(const value of [null,undefined,'6',NaN,Infinity,1.5,{},[]])assert.equal(normalizeAstroidClears(value),0);
assert.equal(normalizeAstroidClears(999),6);assert.notEqual(astroidStorageKey('a'),astroidStorageKey('b'));
let cleared=0;
for(let boss=0;boss<ASTROID_BOSSES.length;boss++){
 let run=startAstroidRun(boss,cleared,1000);
 for(let trap=0;trap<3;trap++){
  assert.equal(run.deadline,11000);assert.equal(run.trap,trap);
  assert.equal(nextAstroidTrap(run,2000),run,'cannot skip an unsolved trap');
  const solution=ASTROID_PUZZLES[boss*3+trap].solutions[0];
  const late=attemptAstroidMove(run,solution,11000);assert.equal(late.phase,'lost','deadline wins over a correct late move');
  assert.equal(expireAstroidRun(run,10999),run);assert.equal(expireAstroidRun(run,11000).phase,'lost');
  assert.equal(attemptAstroidMove(run,{from:'a1',to:'a1'},2000),run);
  const board=new Chess(run.fen);const wrong=board.moves({verbose:true}).find(move=>{const trial=new Chess(run.fen);trial.move(move);return !trial.isCheckmate();});
  assert.equal(attemptAstroidMove(run,wrong,2000).phase,'lost');
  const solved=attemptAstroidMove(run,solution,10999);assert.equal(solved.phase,trap===2?'complete':'solved');
  assert.equal(attemptAstroidMove(solved,solution,11000),solved,'duplicate input cannot consume the next trap');
  if(trap<2)run=nextAstroidTrap(solved,1000);else{cleared=Math.max(cleared,boss+1);assert.equal(nextAstroidTrap(solved,1000),solved);}
 }
}
assert.equal(cleared,6);assert.equal(startAstroidRun(0,6,0).boss,0);
console.log('PASS 18 legal traps, all mating alternatives, six sequential sets, exact ten-second deadlines, wrong moves, timeouts, duplicate inputs, invalid input, replay and account progress normalization.');
