import { Chess } from "./chess";
import type { OnlineGame } from "./onlineChess";

export type BotReaction = { emoji: string; message: string; terminal: boolean };

// Cosmetic reactions use confirmed moves only and never affect the bot's play.
export function fallbackBotReaction(game: OnlineGame, previousPly: number): BotReaction | null {
  if (!game.is_bot) return null;
  if (game.result) {
    if (game.result === "1/2-1/2") return { emoji: "🤝", message: "Good game! A draw.", terminal: true };
    return game.result === "0-1"
      ? { emoji: "👏", message: "Good game!", terminal: true }
      : { emoji: "😮", message: "You got me. Well played!", terminal: true };
  }
  if (game.ply_count <= previousPly) return null;
  const position = new Chess();
  if (game.pgn) position.loadPgn(game.pgn);
  const moves = position.history({ verbose: true });
  const pieces: Record<string, string> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen" };
  for (let index = moves.length - 1; index >= previousPly; index--) {
    const move = moves[index];
    const botMoved = move.color === "b";
    if (move.promotion) return { emoji: botMoved ? "👍" : "😮", message: botMoved ? "Promotion!" : "That promotion changes things!", terminal: false };
    if (move.san.endsWith("+")) return { emoji: botMoved ? "👍" : "😮", message: botMoved ? "Check!" : "My king is in check!", terminal: false };
    if (move.captured) return {
      emoji: botMoved ? "👍" : move.captured === "q" ? "😮" : "😠",
      message: botMoved ? `I captured your ${pieces[move.captured] ?? "piece"}.` : `You captured my ${pieces[move.captured] ?? "piece"}!`, terminal: false,
    };
    if (move.san.startsWith("O-O")) return { emoji: "👍", message: botMoved ? "My king is tucked away." : "Nice castling!", terminal: false };
  }
  return null;
}
