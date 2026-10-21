import type { PlayMode } from "./chess";

export type Progress = {
  wins: number;
  losses: number;
  streak: number;
  bestStreak: number;
  bossesDefeated: number;
  freestyleBossesDefeated: number;
  progressionVersion: number;
};
export type PendingResult = {
  id: string;
  result: "win" | "loss";
  bossIndex: number;
  progressionVersion: number;
  mode: PlayMode;
};
export const EMPTY_PROGRESS: Progress = {
  wins: 0,
  losses: 0,
  streak: 0,
  bestStreak: 0,
  bossesDefeated: 0,
  freestyleBossesDefeated: 0,
  progressionVersion: 3,
};
const LEGACY_BOSS_UNLOCK_WINS = [0, 1, 2, 4, 7, 11, 16];
export const LEGACY_STAGE_TO_RUNG = [0, 5, 12, 20, 30, 42, 58];
const LEGACY_CLEARS_TO_RUNG = [0, 5, 12, 20, 30, 42, 58, 59];

export function normalizeProgress(
  value: Partial<Progress> | null | undefined,
): Progress {
  const wins = Math.max(0, Number(value?.wins) || 0);
  const oldStage = LEGACY_BOSS_UNLOCK_WINS.reduce(
    (stage, threshold, index) => (wins >= threshold ? index : stage),
    0,
  );
  const oldClearCount =
    value?.bossesDefeated === undefined
      ? oldStage
      : Math.min(7, Math.max(0, Math.floor(Number(value.bossesDefeated) || 0)));
  const migratedRung =
    value?.bossesDefeated === undefined
      ? (LEGACY_STAGE_TO_RUNG[oldStage] ?? 0)
      : (LEGACY_CLEARS_TO_RUNG[oldClearCount] ?? 0);
  const progressionVersion = Number(value?.progressionVersion) || 0;
  return {
    wins,
    losses: Math.max(0, Number(value?.losses) || 0),
    streak: Math.max(0, Number(value?.streak) || 0),
    bestStreak: Math.max(0, Number(value?.bestStreak) || 0),
    bossesDefeated: Math.min(
      59,
      Math.max(
        0,
        progressionVersion < 2
          ? migratedRung
          : Math.floor(Number(value?.bossesDefeated) || 0),
      ),
    ),
    freestyleBossesDefeated: Math.min(59, Math.max(0, Math.floor(Number(value?.freestyleBossesDefeated) || 0))),
    progressionVersion: 3,
  };
}

export function mergeProgress(account: Progress, guest: Progress): Progress {
  return {
    wins: account.wins + guest.wins,
    losses: account.losses + guest.losses,
    streak: Math.max(account.streak, guest.streak),
    bestStreak: Math.max(
      account.bestStreak,
      guest.bestStreak,
      account.streak,
      guest.streak,
    ),
    bossesDefeated: Math.max(account.bossesDefeated, guest.bossesDefeated),
    freestyleBossesDefeated: Math.max(account.freestyleBossesDefeated, guest.freestyleBossesDefeated),
    progressionVersion: 3,
  };
}

export function hasProgress(progress: Progress) {
  return (
    progress.wins > 0 ||
    progress.losses > 0 ||
    progress.bossesDefeated > 0 ||
    progress.freestyleBossesDefeated > 0 ||
    progress.bestStreak > 0
  );
}

export function applyResult(progress: Progress, event: PendingResult): Progress {
  if (event.result === "win") {
    const streak = progress.streak + 1;
    return {
      ...progress,
      wins: progress.wins + 1,
      streak,
      bestStreak: Math.max(progress.bestStreak, streak),
      [event.mode === "freestyle" ? "freestyleBossesDefeated" : "bossesDefeated"]:
        Math.max(ladderClears(progress, event.mode), event.bossIndex + 1),
    };
  }
  return { ...progress, losses: progress.losses + 1, streak: 0 };
}


export function ladderClears(progress: Progress, mode: PlayMode): number {
  return mode === "freestyle" ? progress.freestyleBossesDefeated : progress.bossesDefeated;
}
