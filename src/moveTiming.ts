export type MoveTimes = readonly (number | null)[];

export function formatMoveTime(time: number | null | undefined) {
  return typeof time === "number" && Number.isFinite(time) && time >= 0 ? `${(time / 1000).toFixed(1)}s` : "Not recorded";
}

export function normalizeMoveTimes(value: unknown, plies: number): (number | null)[] {
  const times = Array.isArray(value) ? value : [];
  return Array.from({ length: plies }, (_, index) => {
    const time = times[index];
    return typeof time === "number" && Number.isFinite(time) && time >= 0 ? time : null;
  });
}

export function appendMoveTime(times: MoveTimes, previousPlies: number, elapsed: number) {
  return [...normalizeMoveTimes(times, previousPlies), Number.isFinite(elapsed) && elapsed >= 0 ? elapsed : null];
}
