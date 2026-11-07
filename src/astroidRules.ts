import { Chess } from "chess.js";
import puzzles from "./astroidPuzzles.json" with { type: "json" };

export const ASTROID_PUZZLES = puzzles;
export const TRAP_SECONDS = 10;
export const ASTROID_BOSSES = [
  { name: "Dustbite", title: "The first impact", color: "#b79a72" },
  { name: "Crater Jack", title: "Pinned in orbit", color: "#bb8267" },
  { name: "Iron Maw", title: "Heavy metal", color: "#8aafb4" },
  { name: "Neon Wrecker", title: "Dangerous debris", color: "#8fa777" },
  { name: "Voidfang", title: "No escape squares", color: "#a18fbb" },
  { name: "Extinction", title: "The final collision", color: "#d18770" },
] as const;
export type AstroidRun = {
  boss: number; trap: number; fen: string; deadline: number;
  phase: "playing" | "solved" | "lost" | "complete";
  reason?: string; san?: string;
};
export const astroidStorageKey = (account: string) => `arcade-astroid-solver-v1:${account}`;
export function normalizeAstroidClears(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) ? Math.max(0, Math.min(ASTROID_BOSSES.length, value)) : 0;
}
export function trapFor(run: Pick<AstroidRun, "boss" | "trap">) { return ASTROID_PUZZLES[run.boss * 3 + run.trap]; }
export function startAstroidRun(boss: number, cleared: number, now: number): AstroidRun {
  if (!Number.isInteger(boss) || boss < 0 || boss >= ASTROID_BOSSES.length || boss > normalizeAstroidClears(cleared)) throw new Error("Clear the previous sector first.");
  return { boss, trap: 0, fen: ASTROID_PUZZLES[boss * 3].fen, deadline: now + TRAP_SECONDS * 1000, phase: "playing" };
}
export function expireAstroidRun(run: AstroidRun, now: number): AstroidRun {
  return run.phase === "playing" && now >= run.deadline ? { ...run, phase: "lost", reason: "Time ran out. The asteroid reached your ship." } : run;
}
export function attemptAstroidMove(run: AstroidRun, move: { from: string; to: string; promotion?: string }, now: number): AstroidRun {
  if (run.phase !== "playing") return run;
  const checked = expireAstroidRun(run, now);
  if (checked !== run) return checked;
  const board = new Chess(run.fen);
  try {
    const played = board.move(move);
    return { ...run, fen: board.fen(), san: played.san, phase: board.isCheckmate() ? run.trap === 2 ? "complete" : "solved" : "lost",
      reason: board.isCheckmate() ? undefined : "That move leaves the king an escape. Your ship was hit." };
  } catch { return run; } // Invalid destinations are input mistakes, not submitted chess moves.
}
export function nextAstroidTrap(run: AstroidRun, now: number): AstroidRun {
  if (run.phase !== "solved" || run.trap >= 2) return run;
  const trap = run.trap + 1;
  return { boss: run.boss, trap, fen: ASTROID_PUZZLES[run.boss * 3 + trap].fen, deadline: now + TRAP_SECONDS * 1000, phase: "playing" };
}
