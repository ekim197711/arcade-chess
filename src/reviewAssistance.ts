import type { MoveAnalysis } from "./bot";
import type { Move } from "./chess";

// Descriptive agreement only; this is not a calibrated assistance detector.
export function reviewEngineAgreement(moves: readonly Pick<Move, "color">[], analyses: Record<number, MoveAnalysis>, color: "w" | "b") {
  let expected = 0;
  let analyzed = 0;
  let matches = 0;
  let streak = 0;
  let longestStreak = 0;
  moves.forEach((move, index) => {
    if (move.color !== color) return;
    expected++;
    const analysis = analyses[index];
    if (!analysis || !Number.isFinite(analysis.loss) || analysis.loss < 0) {
      streak = 0;
      return;
    }
    analyzed++;
    if (analysis.loss === 0) {
      matches++;
      streak++;
      longestStreak = Math.max(longestStreak, streak);
    } else {
      streak = 0;
    }
  });
  return { expected, analyzed, matches, longestStreak, agreement: analyzed ? 100 * matches / analyzed : null };
}
