import { Chess } from "./chess";
import type { PieceColor } from "./MedievalPiece";

export type ArchivedMatch = {
  id: string; startedAt: string; updatedAt: string; bossIndex: number;
  opponent: string; playerName?: string; elo: number; color: PieceColor; pgn: string;
  result: "win" | "loss" | "draw" | "unfinished"; reason: string;
};
const KEY = "arcade-chess-history-v1";
export function readHistory(): ArchivedMatch[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(data)) return [];
    return data.filter((match) => {
      try {
        if (!match || typeof match.id !== "string" || typeof match.pgn !== "string" ||
          typeof match.opponent !== "string" || (match.playerName !== undefined && typeof match.playerName !== "string") || typeof match.reason !== "string" ||
          !Number.isFinite(match.elo) || !Number.isFinite(Date.parse(match.startedAt)) ||
          !["w", "b"].includes(match.color) || !["win", "loss", "draw", "unfinished"].includes(match.result)) return false;
        new Chess().loadPgn(match.pgn);
        return true;
      } catch { return false; }
    });
  } catch { return []; }
}
export function saveHistory(matches: ArchivedMatch[]): boolean {
  try { localStorage.setItem(KEY, JSON.stringify(matches)); return true; }
  catch { return false; }
}
