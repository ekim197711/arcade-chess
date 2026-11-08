import { Chess } from "chess.js";
import puzzles from "./astroidPuzzles.json" with { type: "json" };

export const REPAIRS = [
  { name: "Hull plating", detail: "Seal the breach before the lunar dust gets in.", puzzle: puzzles[0] },
  { name: "Life support", detail: "Bring the oxygen recyclers back online.", puzzle: puzzles[1] },
  { name: "Power core", detail: "Reconnect the reactor and light up the cockpit.", puzzle: puzzles[3] },
  { name: "Navigation", detail: "Plot a safe course through the asteroid belt.", puzzle: puzzles[6] },
  { name: "Shields", detail: "Restore the shield emitters for the journey home.", puzzle: puzzles[10] },
  { name: "Main engines", detail: "Ignite the thrusters. One last repair to freedom!", puzzle: puzzles[15] },
] as const;
export type StarshipSave = { repaired: number; launched: boolean };
export const starshipKey = (owner: string) => `arcade-starship-v1:${owner}`;
export function normalizeStarship(value: unknown): StarshipSave {
  const raw = value && typeof value === "object" ? value as Partial<StarshipSave> : {};
  const repaired = typeof raw.repaired === "number" && Number.isInteger(raw.repaired) ? Math.max(0, Math.min(REPAIRS.length, raw.repaired)) : 0;
  return { repaired, launched: repaired === REPAIRS.length && raw.launched === true };
}
export function mergeStarship(a: StarshipSave, b: StarshipSave): StarshipSave {
  return normalizeStarship({ repaired: Math.max(a.repaired, b.repaired), launched: a.launched || b.launched });
}
export function repairsWithMove(index: number, move: { from: string; to: string; promotion?: string }) {
  if (!REPAIRS[index]) return false;
  const board = new Chess(REPAIRS[index].puzzle.fen);
  try { board.move(move); return board.isCheckmate(); } catch { return false; }
}
