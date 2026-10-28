import type { MoveAnalysis } from "./bot";
import { Chess, type Move } from "./chess";
import { normalizeMoveTimes, type MoveTimes } from "./moveTiming";

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

export function assistanceSample(moves: readonly Move[], color: "w" | "b") {
  let ownMoves = 0;
  return moves.flatMap((move, index) => {
    if (move.color !== color || ++ownMoves <= 10) return [];
    const position = new Chess(move.before);
    // Exclude opening preparation, checks, nearly forced play and reduced endings.
    if (position.isCheck() || position.moves().length < 3 || position.board().flat().filter(Boolean).length < 10) return [];
    return [index];
  });
}

const median = (values: readonly number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.floor(sorted.length / 2)]) / 2 : null;
};

export function assistanceAssessment(sample: readonly number[], analyses: Record<number, MoveAnalysis>, times: MoveTimes | undefined, source: "server" | "device") {
  const considered = sample.filter(index => {
    const analysis = analyses[index];
    return analysis && Number.isFinite(analysis.loss) && analysis.loss >= 0 && Math.abs(analysis.evaluationBefore) <= 600;
  });
  const validTimes = normalizeMoveTimes(times, (sample.at(-1) ?? -1) + 1);
  const measured = considered.flatMap(index => validTimes[index] === null ? [] : [validTimes[index]!]);
  // Premoves and long interruptions are reported, but excluded from timing signals.
  const thinking = measured.filter(time => time >= 500 && time <= 120000);
  const medianMs = median(measured);
  const thinkingMedian = median(thinking);
  const variation = thinkingMedian ? median(thinking.map(time => Math.abs(time - thinkingMedian)))! / thinkingMedian : null;
  const agreement = considered.length ? considered.filter(index => analyses[index].loss === 0).length / considered.length : null;
  const averageLoss = considered.length ? considered.reduce((sum, index) => sum + analyses[index].loss, 0) / considered.length : null;
  let run = 0, longestRun = 0;
  for (const index of sample) {
    if (considered.includes(index) && analyses[index].loss === 0) longestRun = Math.max(longestRun, ++run);
    else run = 0;
  }
  const analyzedSample = sample.filter(index => analyses[index] && Number.isFinite(analyses[index].loss) && analyses[index].loss >= 0).length;
  const ready = considered.length >= 12 && analyzedSample >= sample.length * .8;
  const timingSignal = thinking.length >= 12 && thinking.length >= considered.length * .8 && thinkingMedian! >= 1500 && variation !== null && variation <= .15;
  let score = 0;
  const signals: string[] = [];
  if (ready) {
    score += agreement! >= .9 ? 3 : agreement! >= .8 ? 2 : agreement! >= .65 ? 1 : 0;
    score += averageLoss! <= 10 ? 2 : averageLoss! <= 25 ? 1 : 0;
    score += longestRun >= 8 ? 2 : longestRun >= 5 ? 1 : 0;
    if (agreement! >= .8) signals.push("High agreement with this review engine.");
    if (longestRun >= 5) signals.push("An extended run of best-scoring moves.");
    if (timingSignal && agreement! >= .8) { score += 2; signals.push("Consistent thinking times alongside high engine agreement."); }
  }
  // These are transparent rule bands, not calibrated cheating probabilities.
  const level = !ready ? "insufficient" : score >= 8 && source === "server" && considered.length >= 25 && thinking.length >= 20 ? "strong" : score >= 5 ? "elevated" : score >= 2 ? "low" : "very-low";
  const label = { insufficient: "Not enough evidence", "very-low": "Very few assistance indicators", low: "Few assistance indicators", elevated: "Elevated assistance indicators", strong: "Strong assistance indicators" }[level];
  return { level, label, considered: considered.length, available: sample.length, agreement, averageLoss, longestRun,
    timed: measured.length, medianMs, variation, timingSignal, signals };
}
