import assert from 'node:assert/strict';
import { createServer } from 'vite';

const vite = await createServer({ server: { watch: null } });
try {
  const { Chess } = await vite.ssrLoadModule('/src/chess.ts');
  const { outcome, replay, botMove } = await vite.ssrLoadModule('/supabase/functions/multiplayer/rules.ts');
  for (const variant of ['', ' chess960']) {
    for (const [fen, reason] of [
      ['7k/5Q2/6K1/8/8/8/8/8 b - - 0 1', 'Stalemate'],
      ['7k/8/6K1/8/8/8/8/8 w - - 0 1', 'Insufficient material'],
      ['7k/8/6K1/8/8/8/8/2B5 w - - 0 1', 'Insufficient material'],
      ['7k/8/6K1/8/8/8/8/2N5 w - - 0 1', 'Insufficient material'],
      ['7k/8/6K1/8/8/8/8/R7 w - - 100 51', 'Fifty-move rule'],
    ]) {
      const game = new Chess(fen + variant);
      for (const restored of [game, replay(game.pgn())]) {
        assert.equal(restored.drawReason(), reason);
        assert(restored.isGameOver());
        assert.deepEqual(outcome(restored), { result: '1/2-1/2', reason });
      }
    }
    const mate = new Chess('7k/6Q1/6K1/8/8/8/8/8 b - - 100 51' + variant);
    assert(mate.isCheckmate()); assert(!mate.isDraw());
    assert.equal(outcome(mate).result, '1-0');
    const game = new Chess('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' + variant);
    for (const move of ['Nf3','Nf6','Ng1','Ng8','Nf3','Nf6','Ng1']) game.move(move);
    assert(!game.isDraw()); game.move('Ng8');
    assert.equal(game.drawReason(), 'Threefold repetition');
    assert.equal(outcome(replay(game.pgn())).reason, 'Threefold repetition');
    game.undo(); assert(!game.isDraw());
    const limit = new Chess('7k/8/6K1/8/8/8/P7/R7 w - - 99 51' + variant);
    limit.move('Rb1'); assert(limit.isDrawByFiftyMoves());
    limit.undo(); limit.move('a3'); assert(!limit.isDrawByFiftyMoves());
    for (const rating of [100, 3000]) {
      const candidate = botMove(game, rating);
      assert(candidate); assert.doesNotThrow(() => game.move(candidate)); game.undo();
    }
  }
  console.log('PASS Standard/Freestyle draws, server outcomes, PGN restoration, undo, move limit/reset, mate precedence and legal bot moves');
} finally { await vite.close(); }
