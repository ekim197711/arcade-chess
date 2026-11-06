import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

// Let Node's TypeScript runner resolve the same relative imports as Vite.
registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); }
  catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
      return next(`${specifier}.ts`, context);
    }
    throw error;
  }
} });
const { Chess, freestyleFen } = await import('./src/chess.ts');
const { chooseBotMove, analyzeMove } = await import('./src/bot.ts');
const { readHistory, saveHistory } = await import('./src/matchArchive.ts');
const restore = (pgn) => { const game = new Chess(); game.loadPgn(pgn); return game; };
const mark = (fen) => `${fen} chess960`;
const ranks = new Set();
for (let index = 0; index < 960; index++) {
  const game = new Chess(freestyleFen(index));
  const [black, pawns, ...rest] = game.fen().split(' ')[0].split('/');
  const white = rest.at(-1);
  ranks.add(white);
  assert.equal(black, white.toLowerCase());
  assert.equal(pawns, 'pppppppp');
  assert.equal(rest.at(-2), 'PPPPPPPP');
  assert.equal([...white].sort().join(''), 'BBKNNQRR');
  assert.notEqual(white.indexOf('B') % 2, white.lastIndexOf('B') % 2);
  assert(white.indexOf('R') < white.indexOf('K') && white.indexOf('K') < white.lastIndexOf('R'));
  assert.equal(restore(game.pgn()).fen(), game.fen());
  const before = game.fen();
  const move = game.moves({ verbose: true })[0];
  game.move({ from: move.from, to: move.to, promotion: 'q' });
  assert.equal(restore(game.pgn()).fen(), game.fen());
  game.undo(); assert.equal(game.fen(), before);
}
assert.equal(ranks.size, 960);
assert.equal(freestyleFen(518).split('/').at(-1).split(' ')[0], 'RNBQKBNR');
console.log('PASS all 960 unique legal arrays, matching colors, first moves, PGN, undo');

function rank(pieces) {
  return Array.from({ length: 8 }, (_, file) => pieces[file] ?? '1').join('').replace(/1+/g, (empty) => empty.length);
}
for (const color of ['w', 'b']) {
  for (let king = 0; king < 8; king++) for (let rook = 0; rook < 8; rook++) {
    if (king === rook) continue;
    const home = rank({ [king]: color === 'w' ? 'K' : 'k', [rook]: color === 'w' ? 'R' : 'r' });
    const rights = String.fromCharCode((color === 'w' ? 65 : 97) + rook);
    const board = color === 'w' ? `4k3/pppppppp/8/8/8/8/8/${home}` : `${home}/8/8/8/8/8/PPPPPPPP/4K3`;
    const game = new Chess(mark(`${board} ${color} ${rights} - 0 1`));
    const before = game.fen();
    const row = color === 'w' ? '1' : '8';
    const from = String.fromCharCode(97 + king) + row;
    const to = String.fromCharCode(97 + rook) + row;
    assert(game.moves({ square: from, verbose: true }).some((move) => move.to === to));
    const move = game.move({ from, to, promotion: 'q' });
    assert.equal(move.san, rook > king ? 'O-O' : 'O-O-O');
    assert.equal(move.captured, undefined);
    assert.deepEqual(game.get((rook > king ? 'g' : 'c') + row), { color, type: 'k' });
    assert.deepEqual(game.get((rook > king ? 'f' : 'd') + row), { color, type: 'r' });
    assert.equal(restore(game.pgn()).fen(), game.fen());
    assert.equal(new Chess(game.fen()).mode, 'freestyle');
    game.undo(); assert.equal(game.fen(), before);
  }
}
const castle = (fen) => new Chess(mark(fen)).moves().some((san) => san.startsWith('O-O'));
assert(!castle('k4r2/8/8/8/8/8/8/4K2R w H - 0 1')); // through check
assert(!castle('k3r3/8/8/8/8/8/8/4K2R w H - 0 1')); // out of check
assert(!castle('k5r1/8/8/8/8/8/8/4K2R w H - 0 1')); // into check
assert(!castle('4k3/8/8/8/8/8/8/rRK5 w B - 0 1')); // rook uncovers attack
assert(!castle('k7/8/8/8/8/8/8/4KB1R w H - 0 1')); // blocked path
assert(castle('k6r/8/8/8/8/8/8/4K2R w H - 0 1')); // attacked rook is allowed
const lostRights = new Chess(mark('k7/8/8/8/8/8/8/4K2R w H - 0 1'));
for (const san of ['Rh2', 'Kb7', 'Rh1', 'Ka8']) lostRights.move(san);
assert(!lostRights.moves().some((san) => san.startsWith('O-O')));
const lostKingRights = new Chess(mark('k7/8/8/8/8/8/8/4K2R w H - 0 1'));
for (const san of ['Ke2', 'Kb7', 'Ke1', 'Ka8']) lostKingRights.move(san);
assert(!lostKingRights.moves().some((san) => san.startsWith('O-O')));
console.log('PASS 112 castling layouts for both colors, stationary king/rook, swaps, checks, blockers, lost rights');

const ep = new Chess(mark('k7/8/8/3pP3/8/8/8/4K3 w - d6 0 1'));
assert(ep.move('exd6').isEnPassant()); assert.equal(ep.get('d5'), undefined);
const promotion = new Chess(mark('8/6P1/k7/8/8/8/8/4K3 w - - 0 1'));
assert.equal(promotion.moves({ square: 'g7', verbose: true }).length, 4);
promotion.move({ from: 'g7', to: 'g8', promotion: 'n' }); assert.equal(promotion.get('g8').type, 'n');
const repeat = new Chess(freestyleFen(518));
for (const san of ['Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1', 'Ng8']) repeat.move(san);
assert(repeat.isThreefoldRepetition()); assert(restore(repeat.pgn()).isDraw());
const mate = new Chess(freestyleFen(518));
for (const san of ['f3', 'e5', 'g4', 'Qh4#']) mate.move(san);
assert(mate.isCheckmate());
assert(new Chess(mark('k7/2Q5/2K5/8/8/8/8/8 b - - 0 1')).isStalemate());
assert(new Chess(mark('k7/8/8/8/8/8/8/4K3 w - - 0 1')).isInsufficientMaterial());
assert(new Chess(mark('k7/8/8/8/8/8/8/4K2R w - - 100 1')).isDraw());
assert.doesNotThrow(() => new Chess(mate.history({ verbose: true }).at(-1).before).premoveTargets('e1', 'w'));
const checking = new Chess(mark('k7/8/8/8/8/8/8/4K2R w - - 0 1'));
checking.move('Rh8+'); assert.doesNotThrow(() => checking.premoveTargets('e1', 'w'));
console.log('PASS en passant, promotion choices, repetition, checkmate, stalemate, material, fifty moves, premoves');

for (const index of [0, 518, 959]) for (const elo of [100, 3000]) {
  const game = new Chess(freestyleFen(index));
  game.move('e4');
  const move = chooseBotMove(game.fen(), elo);
  assert(move); assert.doesNotThrow(() => game.move(move));
}
const review = new Chess(mark('k7/8/8/8/8/8/8/4K2R w H - 0 1'));
assert.doesNotThrow(() => analyzeMove(review.fen(), 'O-O'));
let stored;
globalThis.localStorage = { getItem: () => stored ?? null, setItem: (_, value) => { stored = value; } };
const match = { id: 'freestyle', startedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), bossIndex: 0, opponent: 'Boss', elo: 100, color: 'w', pgn: mate.pgn(), result: 'loss', reason: 'Checkmate' };
assert(saveHistory([match])); assert.equal(readHistory()[0].pgn, mate.pgn());
await import('./archive-check.mjs');
await import('./review-engine-check.mjs');
await import('./review-skills-check.mjs');
console.log('PASS low/high bots, castling analysis, freestyle archive and existing archive/review regressions');
