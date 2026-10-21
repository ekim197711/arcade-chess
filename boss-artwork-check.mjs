import assert from 'node:assert/strict';
import { readdirSync, existsSync, writeFileSync } from 'node:fs';
import { BOSS_CHARACTERS, resolveBossCharacter, bossPortrait } from './src/bossArtwork.ts';

const root = 'public/characters';
const folders = readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name);
const inventory = Object.fromEntries(folders.map(folder => [folder,
  readdirSync(`${root}/${folder}`).filter(file => file.endsWith('.png')).map(file => file.slice(0, -4)),
]));
const missingFolders = [];
const emptyFolders = [];
const assigned = new Set();
for (const { name, folder } of BOSS_CHARACTERS) {
  const mapped = resolveBossCharacter(name, inventory);
  assert.equal(mapped, folder, name);
  assert(!assigned.has(mapped), `Duplicate folder assignment: ${mapped}`);
  assigned.add(mapped);
  if (!Object.hasOwn(inventory, mapped)) missingFolders.push({ name, folder });
  else if (!inventory[mapped].length) emptyFolders.push({ name, folder });
  for (const expression of ['focused', 'angry', 'taunting', 'won', 'lost']) {
    const portrait = bossPortrait(mapped, inventory, expression);
    if (portrait) assert(existsSync(`public${portrait}`), `${name}: ${expression} points to a missing file`);
    else assert(!inventory[mapped]?.length, `${name}: usable artwork was not selected`);
  }
}
assert.equal(BOSS_CHARACTERS.length, 59);
const unmappedFolders = folders.filter(folder => !assigned.has(folder));
assert.deepEqual(unmappedFolders, [], 'Every character folder must belong to a boss');
assert.equal(resolveBossCharacter('Checkpoint Celine', inventory), 'checkpoint-celine');
assert.equal(bossPortrait('checkpoint-celine', { 'checkpoint-celine': ['focused'] }), '/characters/checkpoint-celine/focused.png');
assert.equal(bossPortrait('checkpoint-celine', { 'checkpoint-celine': [] }), undefined);
assert.equal(resolveBossCharacter('Rook’n’Roll Ricky', inventory), 'rook-n-roll-ricky');
assert.equal(resolveBossCharacter('Checkpoint Céline', inventory), 'checkpoint-celine');
assert.equal(resolveBossCharacter('Mate-in-Two Milo', { 'mate in two milo': ['focused'] }), 'mate in two milo');
assert.equal(bossPortrait('example', { example: ['angry'] }), '/characters/example/angry.png');

const list = entries => entries.length ? entries.map(({ name, folder }) => `- ${name}: \`${folder}\``).join('\n') : 'None.';
const report = `# Boss artwork audit

All ${BOSS_CHARACTERS.length} bosses have explicit folder mappings in \`src/bossArtwork.ts\`, shared by the Standard and Freestyle ladders.
${BOSS_CHARACTERS.length - missingFolders.length - emptyFolders.length} bosses currently have PNG artwork. Every existing character folder is assigned to a boss.

## Missing folders

${list(missingFolders)}

## Existing folders without PNG artwork

These mappings are valid, but the folders have no images to display. The app uses its mascot fallback until artwork is supplied.

${list(emptyFolders)}

## Verification

Run \`node boss-artwork-check.mjs\` to audit mappings and image paths. Add \`--write\` to refresh this report.
`;
if (process.argv.includes('--write')) writeFileSync('BOSS_ARTWORK_AUDIT.md', report);
console.log(JSON.stringify({ mappedBosses: BOSS_CHARACTERS.length, usableArtwork: BOSS_CHARACTERS.length - missingFolders.length - emptyFolders.length, missingFolders, emptyFolders, unmappedFolders }, null, 2));
console.log('PASS explicit mappings, unique folder assignments, all expression paths, punctuation/accent aliases, empty-folder handling, portrait fallback');
