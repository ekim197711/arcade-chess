import type { Chess } from "./chess";

export function reviewEvaluationChange(current: number | undefined, previous: number | undefined): string | null {
  if (current === undefined || previous === undefined || !Number.isFinite(current) || !Number.isFinite(previous) || Math.abs(current) >= 100_000 || Math.abs(previous) >= 100_000) return null;
  const difference = (current - previous) / 100;
  return `${difference > 0 ? "+" : ""}${difference.toFixed(2)}`;
}

export function reviewAdvantage(position: Chess, score: number | undefined, failed: boolean) {
  if (position.isCheckmate()) {
    const whiteWon = position.turn() === "b";
    return { label: `${whiteWon ? "White" : "Black"} wins by checkmate`, score: whiteWon ? "1–0" : "0–1", whitePercent: whiteWon ? 100 : 0, pending: false };
  }
  if (position.isDraw()) return { label: "Drawn position", score: "½–½", whitePercent: 50, pending: false };
  if (score === undefined || !Number.isFinite(score)) {
    return { label: failed ? "Evaluation unavailable" : "Analyzing position…", score: "—", whitePercent: 50, pending: true };
  }
  const side = score > 0 ? "White" : "Black";
  const mate = Math.abs(score) >= 100_000;
  return {
    label: mate ? `${side} has a forced mate` : Math.abs(score) < 50 ? "About equal" : `${side} is ahead`,
    score: mate ? `${score > 0 ? "+" : "−"}M` : `${score > 0 ? "+" : ""}${(score / 100).toFixed(2)}`,
    // A bounded visual scale, not a winning probability.
    whitePercent: mate ? score > 0 ? 100 : 0 : 50 + 50 * Math.tanh(score / 600),
    pending: false,
  };
}
