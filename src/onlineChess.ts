import { Chess, type Move } from "./chess";

export const ONLINE_TIME_CONTROLS = [3, 5, 10, 15] as const;
export type OnlineGame = {
  id: string; white_id: string; black_id: string | null;
  white_name: string; black_name: string; white_rating: number; black_rating: number;
  is_bot: boolean; minutes: number; pgn: string; fen: string; turn: "w" | "b";
  white_ms: number; black_ms: number; turn_started_at: string; created_at: string;
  finished_at: string | null; result: "1-0" | "0-1" | "1/2-1/2" | null;
  reason: string; version: number; ply_count: number; draw_offer: string | null;
  rated: boolean; white_delta: number; black_delta: number;
  white_seen_at: string; black_seen_at: string;
  white_disconnected_at: string | null; black_disconnected_at: string | null;
  move_times_ms?: (number | null)[];
};
export type OnlinePremove = { from: import("./chess").Square; to: import("./chess").Square; promotion?: "q" | "r" | "b" | "n"; x?: number; y?: number };
export function reconnectDeadline(game: OnlineGame, side: "w" | "b") {
  if (game.result || (side === "b" && game.is_bot)) return null;
  const disconnected = side === "w" ? game.white_disconnected_at : game.black_disconnected_at;
  const seen = side === "w" ? game.white_seen_at : game.black_seen_at;
  return Date.parse(disconnected ?? seen) + 20_000;
}
export type OnlineProfile = { user_id: string; display_name: string; rating: number; peak_rating: number; rated_games: number };
export function clockRemaining(game: OnlineGame, side: "w" | "b", serverNow: number) {
  const saved = side === "w" ? game.white_ms : game.black_ms;
  return Math.max(0, saved - (!game.result && game.turn === side ? Math.max(0, serverNow-Date.parse(game.turn_started_at)) : 0));
}
export function formatClock(milliseconds: number) {
  const seconds = Math.max(0, Math.ceil(milliseconds/1000));
  return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,"0")}`;
}

export type OnlineMovePrediction = { base: OnlineGame; game: OnlineGame; move: Move; status: "saving" | "uncertain" };
export function predictOnlineMove(game: OnlineGame, input: { from: string; to: string; promotion?: string }, serverNow: number): OnlineMovePrediction {
  const position = new Chess();
  if (game.pgn) position.loadPgn(game.pgn);
  const move = position.move(input);
  return {
    base: game, move, status: "saving",
    // Only the server can finalize a result, clock or rating.
    game: { ...game, pgn: position.pgn(), fen: position.fen(), turn: position.turn(), ply_count: game.ply_count + 1,
      white_ms: clockRemaining(game,"w",serverNow), black_ms: clockRemaining(game,"b",serverNow), turn_started_at: new Date(serverNow).toISOString() },
  };
}
export function predictionWasSaved(prediction: OnlineMovePrediction, confirmed: OnlineGame) {
  if (prediction.base.id !== confirmed.id || confirmed.ply_count <= prediction.base.ply_count) return false;
  const position = new Chess();
  if (confirmed.pgn) position.loadPgn(confirmed.pgn);
  const move = position.history({ verbose: true })[prediction.base.ply_count];
  return !!move && move.from === prediction.move.from && move.to === prediction.move.to && move.promotion === prediction.move.promotion;
}
