import type { MoveAnalysis } from "./bot";
import type { Move } from "./chess";

// A local review estimate: one pawn of loss halves the move's accuracy.
export function moveAccuracy(analysis?: Pick<MoveAnalysis, "loss">): number | null {
  if (!analysis || !Number.isFinite(analysis.loss)) return null;
  return 100 * 2 ** (-Math.max(0, analysis.loss) / 100);
}

export function reviewAccuracy(moves: readonly Pick<Move, "color">[], analyses: Record<number, MoveAnalysis>, color: "w" | "b") {
  let total = 0;
  let analyzed = 0;
  let expected = 0;
  moves.forEach((move, index) => {
    if (move.color !== color) return;
    expected++;
    const accuracy = moveAccuracy(analyses[index]);
    if (accuracy === null) return;
    total += accuracy;
    analyzed++;
  });
  return { score: analyzed ? total / analyzed : null, analyzed, expected };
}
