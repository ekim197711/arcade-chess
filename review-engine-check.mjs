import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { analyzeMove, chooseBotMove } from './src/bot.ts';
for (const pgn of ['1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7#', '1. f3 e5 2. g4 Qh4#', '1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. O-O']) {
  const game = new Chess(); game.loadPgn(pgn);
  for (const move of game.history({verbose:true})) {
    const result = analyzeMove(move.before, move.san);
    assert.ok(new Chess(move.before).moves().includes(result.suggested));
    assert.ok(Number.isFinite(result.loss) && result.loss >= 0);
    if (move.san.endsWith('#')) assert.equal(result.matches, true);
  }
}
const promotion = new Chess('7k/P7/8/8/8/8/8/7K w - - 0 1');
assert.ok(promotion.moves().includes(analyzeMove(promotion.fen(), 'a8=N').suggested));
for (const elo of [100, 3000]) {
 const game = new Chess(); const move = chooseBotMove(game.fen(), elo); assert.ok(game.move(move));
}
console.log('PASS legal deterministic suggestions, mate, castling, promotion, low/high bot legal moves');
const beforeMate = new Chess(); beforeMate.loadPgn('1. f3 e5');
const mateMistake = analyzeMove(beforeMate.fen(), 'g4');
assert.match(mateMistake.explanation, /allows Qh4#, checkmate/);
assert.deepEqual(mateMistake.playedLine, ['g4', 'Qh4#']);
const attack = new Chess(); attack.loadPgn('1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6');
assert.match(analyzeMove(attack.fen(), 'd3').explanation, /misses an immediate checkmate/);
assert.match(analyzeMove(attack.fen(), 'Qxf7#').explanation, /delivers checkmate/);
const queen = new Chess(); queen.loadPgn('1. e4 e5 2. Qh5 Nc6');
const queenMistake = analyzeMove(queen.fen(), 'Qxe5+');
assert.match(queenMistake.explanation, /capturing a queen/);
for (const [position, san] of [[beforeMate, 'g4'], [attack, 'd3'], [queen, 'Qxe5+']]) {
  const analysis = analyzeMove(position.fen(), san);
  for (const line of [analysis.playedLine, analysis.suggestedLine]) {
    const replay = new Chess(position.fen());
    for (const move of line) assert.ok(replay.move(move));
  }
}
console.log('PASS explanations for allowed mate, missed mate, delivered mate, queen loss, and legal reply lines');
