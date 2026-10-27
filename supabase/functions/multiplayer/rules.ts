import { Chess, type Color } from 'npm:chess.js@1.4.0';

export function replay(pgn: string) {
  const game = new Chess();
  if (pgn) game.loadPgn(pgn);
  return game;
}

export function outcome(game: Chess): { result: string | null; reason: string } {
  if (game.isCheckmate()) return { result: game.turn() === 'w' ? '0-1' : '1-0', reason: 'Checkmate' };
  if (game.isStalemate()) return { result: '1/2-1/2', reason: 'Stalemate' };
  if (game.isInsufficientMaterial()) return { result: '1/2-1/2', reason: 'Insufficient material' };
  if (game.isThreefoldRepetition()) return { result: '1/2-1/2', reason: 'Threefold repetition' };
  if (game.isDraw()) return { result: '1/2-1/2', reason: 'Fifty-move rule' };
  return { result: null, reason: '' };
}

export function timeoutResult(game: Chess) {
  const winner: Color = game.turn() === 'w' ? 'b' : 'w';
  const canMate = game.board().flat().some(piece => piece?.color === winner && piece.type !== 'k');
  return !canMate || game.isInsufficientMaterial() ? '1/2-1/2' : winner === 'w' ? '1-0' : '0-1';
}

// Server-owned practice bot. Its strength target is approximate and never rated.
export function botMove(game: Chess, rating: number) {
  const values: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  const side = game.turn();
  const evaluate = () => {
    if (game.isCheckmate()) return game.turn() === side ? -100000 : 100000;
    if (game.isDraw()) return 0;
    return game.board().flat().reduce((sum, piece) => sum + (piece ? (piece.color === side ? 1 : -1) * (values[piece.type] + (piece.type === 'p' ? (piece.color === 'w' ? Number(piece.square[1])-2 : 7-Number(piece.square[1])) * 5 : 0)) : 0), 0);
  };
  const candidates = game.moves({ verbose: true }).map(move => {
    game.move(move);
    let score = evaluate();
    if (!game.isGameOver()) {
      score = Infinity;
      for (const reply of game.moves()) {
        game.move(reply); score = Math.min(score, evaluate()); game.undo();
      }
    }
    game.undo();
    return { move, score: score + Math.random() * Math.max(5, 300-rating/8) };
  }).sort((a,b) => b.score-a.score);
  return candidates[0]?.move;
}
