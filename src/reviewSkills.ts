import type { Move } from "chess.js";
import type { MoveAnalysis } from "./bot";

const SKILLS = ["Opening", "Tactics", "Strategy", "Endgame"] as const;
type Skill = typeof SKILLS[number];
const MIN_MOVES = 3;

export function evaluateReviewSkills(moves: Move[], analyses: Record<number, MoveAnalysis>, color: "w" | "b") {
  const losses: Record<Skill, number[]> = { Opening: [], Tactics: [], Strategy: [], Endgame: [] };
  moves.forEach((move, index) => {
    const analysis = analyses[index];
    if (move.color !== color || !analysis || !Number.isFinite(analysis.loss)) return;
    const [board, , , , , fullmove] = move.before.split(" ");
    // Material in pawn units, excluding pawns and kings, for both sides combined.
    const material = [...board].reduce((sum, piece) => sum + ({ n: 3, b: 3, r: 5, q: 9 }[piece.toLowerCase()] ?? 0), 0);
    const endgame = material <= 13;
    const opening = !endgame && Number(fullmove) <= 10;
    // Include forcing alternatives and replies, so missed tactics count too.
    const tactical = !!move.captured || !!move.promotion ||
      [...analysis.playedLine, ...analysis.suggestedLine].some((san) => /[x+#=]/.test(san));
    const loss = Math.max(0, analysis.loss);
    if (opening) losses.Opening.push(loss);
    if (endgame) losses.Endgame.push(loss);
    if (tactical) losses.Tactics.push(loss);
    if (!opening && !endgame && !tactical) losses.Strategy.push(loss);
  });
  return SKILLS.map((name) => {
    const samples = losses[name];
    const meanLoss = samples.reduce((sum, loss) => sum + loss, 0) / samples.length;
    // A deliberately coarse, uncalibrated performance scale, not a measured Elo rating.
    const elo = samples.length < MIN_MOVES ? null : Math.round((400 + 2000 * Math.exp(-meanLoss / 100)) / 50) * 50;
    return { name, elo, moves: samples.length };
  });
}

export function evaluatePlayerElo(moves: Move[], analyses: Record<number, MoveAnalysis>, color: "w" | "b") {
  const losses = moves.flatMap((move, index) => {
    const loss = analyses[index]?.loss;
    return move.color === color && Number.isFinite(loss) ? [Math.max(0, loss!)] : [];
  });
  if (losses.length < MIN_MOVES) return null;
  const meanLoss = losses.reduce((sum, loss) => sum + loss, 0) / losses.length;
  return Math.round((400 + 2000 * Math.exp(-meanLoss / 100)) / 50) * 50;
}
