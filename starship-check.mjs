import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { REPAIRS, repairsWithMove, normalizeStarship, mergeStarship, starshipKey } from './src/starshipRules.ts';
assert.equal(REPAIRS.length, 6);
assert.equal(new Set(REPAIRS.map(r => r.puzzle.fen)).size, 6);
for (const [index, {puzzle}] of REPAIRS.entries()) {
  const board = new Chess(puzzle.fen);
  assert.equal(board.turn(), puzzle.side);
  for (const solution of puzzle.solutions) assert(repairsWithMove(index, solution));
  for (const move of board.moves({verbose:true})) {
    const trial = new Chess(puzzle.fen); trial.move(move);
    assert.equal(repairsWithMove(index, move), trial.isCheckmate());
  }
  assert.equal(repairsWithMove(index, {from:'a1', to:'a1'}), false);
}
for (const repaired of [null, '6', NaN, Infinity, 1.2, {}, []]) assert.deepEqual(normalizeStarship({repaired, launched:true}), {repaired:0, launched:false});
assert.deepEqual(normalizeStarship({repaired:4, launched:true}), {repaired:4, launched:false});
assert.deepEqual(normalizeStarship({repaired:6, launched:true}), {repaired:6, launched:true});
assert.deepEqual(mergeStarship({repaired:6, launched:true}, {repaired:2, launched:false}), {repaired:6, launched:true});
assert.notEqual(starshipKey('guest'), starshipKey('account'));
console.log('PASS: six legal repair puzzles, every legal alternative, bad moves, malformed saves, monotonic merging and account isolation.');
