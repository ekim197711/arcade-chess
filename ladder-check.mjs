import assert from 'node:assert/strict';
import { EMPTY_PROGRESS, normalizeProgress, mergeProgress, applyResult, ladderClears, hasProgress } from './src/progress.ts';

const event = (mode, bossIndex, result = 'win') => ({ id: crypto.randomUUID(), mode, bossIndex, result, progressionVersion: 3 });
for (const mode of ['standard', 'freestyle']) {
  const other = mode === 'standard' ? 'freestyle' : 'standard';
  for (const index of [0, 1, 57, 58]) {
    const progress = applyResult(EMPTY_PROGRESS, event(mode, index));
    assert.equal(ladderClears(progress, mode), index + 1);
    assert.equal(ladderClears(progress, other), 0);
    const loss = applyResult(progress, event(mode, index, 'loss'));
    assert.equal(ladderClears(loss, mode), index + 1);
    assert.equal(ladderClears(loss, other), 0);
  }
}
const legacy = normalizeProgress({ wins: 7, bossesDefeated: 3, progressionVersion: 1 });
assert.equal(legacy.bossesDefeated, 20);
assert.equal(legacy.freestyleBossesDefeated, 0);
assert.equal(normalizeProgress({ wins: 4 }).bossesDefeated, 20);
for (const count of [0, 1, 58, 59]) {
  const upgraded = normalizeProgress({ bossesDefeated: count, progressionVersion: 2 });
  assert.equal(upgraded.bossesDefeated, count);
  assert.equal(upgraded.freestyleBossesDefeated, 0);
  assert.equal(upgraded.progressionVersion, 3);
}
const account = { ...EMPTY_PROGRESS, wins: 10, bossesDefeated: 58, freestyleBossesDefeated: 1 };
const guest = { ...EMPTY_PROGRESS, wins: 3, bossesDefeated: 1, freestyleBossesDefeated: 59 };
assert.deepEqual(mergeProgress(account, guest), { ...EMPTY_PROGRESS, wins: 13, bossesDefeated: 58, freestyleBossesDefeated: 59 });
const queued = [event('freestyle', 1), event('standard', 58)].reduce(applyResult, account);
assert.equal(queued.bossesDefeated, 59);
assert.equal(queued.freestyleBossesDefeated, 2);
assert(hasProgress({ ...EMPTY_PROGRESS, freestyleBossesDefeated: 1 }));
assert.equal(normalizeProgress(JSON.parse(JSON.stringify(queued))).freestyleBossesDefeated, 2);
assert.equal(normalizeProgress({ freestyleBossesDefeated: 900, bossesDefeated: -2, progressionVersion: 3 }).freestyleBossesDefeated, 59);
console.log('PASS independent ladder wins/losses, 100/150/2950/3000 indexing, v1/v2 migrations, mode-specific queued results, guest/account merge, persistence');
