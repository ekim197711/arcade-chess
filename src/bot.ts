import { Chess, type Move, type Square } from "./chess";

const PIECE_VALUE: Record<string, number> = {
  p: 100,
  n: 320,
  b: 335,
  r: 500,
  q: 900,
  k: 20_000,
};

const MATE_SCORE = 100_000;

function evaluate(position: Chess): number {
  if (position.isCheckmate()) {
    return position.turn() === "w" ? -MATE_SCORE : MATE_SCORE;
  }
  if (position.isDraw()) return 0;

  let score = 0;
  for (const row of position.board()) {
    for (const piece of row) {
      if (!piece) continue;
      const sign = piece.color === "w" ? 1 : -1;
      const rank = Number(piece.square[1]);
      const file = piece.square.charCodeAt(0) - 97;
      const centerBonus =
        7 - (Math.abs(3.5 - file) + Math.abs(3.5 - (rank - 1)));
      const advancement =
        piece.type === "p"
          ? (piece.color === "w" ? rank - 2 : 7 - rank) * 7
          : 0;
      score +=
        sign *
        (PIECE_VALUE[piece.type] +
          centerBonus * (piece.type === "n" || piece.type === "b" ? 5 : 1) +
          advancement);
    }
  }
  return score;
}

function search(
  position: Chess,
  depth: number,
  alpha: number,
  beta: number,
): number {
  if (depth === 0 || position.isGameOver()) return evaluate(position);

  const moves = position.moves({ verbose: true }).sort((a, b) => {
    const captureA = a.captured ? PIECE_VALUE[a.captured] : 0;
    const captureB = b.captured ? PIECE_VALUE[b.captured] : 0;
    return captureB - captureA;
  });
  const maximizing = position.turn() === "w";
  let best = maximizing ? -Infinity : Infinity;

  for (const move of moves) {
    position.move(move);
    const score = search(position, depth - 1, alpha, beta);
    position.undo();

    if (maximizing) {
      best = Math.max(best, score);
      alpha = Math.max(alpha, best);
    } else {
      best = Math.min(best, score);
      beta = Math.min(beta, best);
    }
    if (beta <= alpha) break;
  }
  return best;
}

export function chooseBotMove(fen: string, elo: number): Move | null {
  const position = new Chess(fen);
  const legalMoves = position.moves({ verbose: true });
  if (legalMoves.length === 0) return null;

  if (elo <= 150 || Math.random() < Math.max(0.025, 0.52 - elo / 5000)) {
    return legalMoves[Math.floor(Math.random() * legalMoves.length)] ?? null;
  }

  const depth = elo < 800 ? 1 : elo < 1750 ? 2 : 3;
  const maximizing = position.turn() === "w";
  const orderedMoves = [...legalMoves].sort((a, b) => {
    const captureA = a.captured ? PIECE_VALUE[a.captured] : 0;
    const captureB = b.captured ? PIECE_VALUE[b.captured] : 0;
    return captureB - captureA;
  });
  let alpha = -Infinity;
  let beta = Infinity;
  const scored = orderedMoves.map((move) => {
    position.move(move);
    const score = search(position, depth - 1, alpha, beta);
    position.undo();
    if (maximizing) alpha = Math.max(alpha, score);
    else beta = Math.min(beta, score);
    return { move, score: maximizing ? score : -score };
  });

  scored.sort((a, b) => b.score - a.score);
  const choiceCount =
    elo < 500 ? 9 : elo < 1000 ? 5 : elo < 1800 ? 3 : elo < 2500 ? 2 : 1;
  const candidates = scored.slice(0, Math.min(choiceCount, scored.length));
  const weights = candidates.map((_, index) => 1 / (index + 1) ** 1.6);
  let choice = Math.random() * weights.reduce((sum, weight) => sum + weight, 0);

  for (let index = 0; index < candidates.length; index += 1) {
    choice -= weights[index] ?? 0;
    if (choice <= 0) return candidates[index]?.move ?? null;
  }
  return candidates[0]?.move ?? null;
}

export function legalTargets(fen: string, square: Square): Square[] {
  return new Chess(fen).moves({ square, verbose: true }).map((move) => move.to);
}

export type MoveAnalysis = {
  /** Position scores in centipawns, always positive for White. */
  evaluationBefore: number;
  evaluationAfter: number;
  suggested: string;
  loss: number;
  matches: boolean;
  worst: boolean;
  explanation: string;
  playedLine: string[];
  suggestedLine: string[];
};

// Deterministic two-ply review: score every candidate with a full search window.
// Scores are relative to the mover, and are only a lightweight estimate.
export function analyzeMove(fen: string, playedSan: string): MoveAnalysis {
  const position = new Chess(fen);
  const sign = position.turn() === "w" ? 1 : -1;
  const candidates = position.moves({ verbose: true }).map((move) => {
    position.move(move);
    const score = sign * search(position, 1, -Infinity, Infinity);
    position.undo();
    return { san: move.san, score };
  });
  const played = candidates.find((move) => move.san === playedSan);
  if (!played) throw new Error("Move does not belong to this position.");
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0]!;
  const loss = Math.max(0, best.score - played.score);
  const playedLine = reviewLine(fen, played.san);
  const suggestedLine = loss === 0 ? playedLine : reviewLine(fen, best.san);
  let explanation: string;
  if (playedLine.mateForMover) {
    explanation = `${played.san} delivers checkmate. The opposing king has no legal escape.`;
  } else if (loss === 0) {
    explanation = playedLine.mated
      ? "This move ties for the best score, but every legal move still allows checkmate on the next turn."
      : playedLine.draw
        ? "This move secures a draw, which is the best result found in this short search."
        : `${played.san} ties for the best score after checking every legal move and the opponent's immediate replies.`;
  } else if (suggestedLine.mateForMover) {
    explanation = `${played.san} misses an immediate checkmate. ${best.san} ends the game before the opponent can reply.`;
  } else if (playedLine.mated) {
    explanation = `${played.san} allows ${playedLine.reply!.san}, checkmate. ${best.san} avoids immediate checkmate in this search.`;
  } else if (suggestedLine.draw && best.score > played.score) {
    explanation = `${best.san} secures a draw. The played move leaves a worse position in the short search.`;
  } else {
    const materialDifference = sign * (suggestedLine.material - playedLine.material);
    const reply = playedLine.reply;
    const capture = reply?.captured
      ? `After ${played.san}, the opponent can play ${reply.san}, capturing ${PIECE_LABELS[reply.captured]} on ${reply.to}. `
      : "";
    explanation = materialDifference >= 50
      ? `${capture}${best.san} leaves the moving side about ${(materialDifference / 100).toFixed(1)} pawns better off in material after the replies shown. This includes captures and promotions on both sides.`
      : `${capture}${best.san} scores better mainly on piece placement and pawn advancement in this short search, rather than a clear material gain.`;
    explanation += ` Estimated evaluation difference: ${(loss / 100).toFixed(2)} pawns.`;
  }
  return {
    evaluationBefore: sign * best.score,
    evaluationAfter: sign * played.score,
    suggested: loss === 0 ? played.san : best.san, loss, matches: loss === 0,
    worst: loss >= 100 && played.score === candidates.at(-1)!.score,
    explanation, playedLine: playedLine.moves, suggestedLine: suggestedLine.moves,
  };
}

const PIECE_LABELS: Record<string, string> = {
  p: "a pawn", n: "a knight", b: "a bishop", r: "a rook", q: "a queen", k: "the king",
};

// Explain the same two-ply search used for the rating, with a legal concrete reply.
function reviewLine(fen: string, san: string) {
  const position = new Chess(fen);
  const mover = position.turn();
  const sign = mover === "w" ? 1 : -1;
  position.move(san);
  const mateForMover = position.isCheckmate();
  let reply: Move | undefined;
  let lowest = Infinity;
  if (!position.isGameOver()) {
    for (const candidate of position.moves({ verbose: true })) {
      position.move(candidate);
      const score = sign * evaluate(position);
      position.undo();
      if (score < lowest) { lowest = score; reply = candidate; }
    }
  }
  if (reply) position.move(reply);
  const material = position.board().flat().reduce((total, piece) =>
    total + (piece && piece.type !== "k" ? (piece.color === "w" ? 1 : -1) * PIECE_VALUE[piece.type]! : 0), 0);
  return {
    moves: reply ? [san, reply.san] : [san], reply, material, mateForMover,
    mated: position.isCheckmate() && position.turn() === mover,
    draw: position.isDraw(),
  };
}
