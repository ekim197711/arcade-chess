import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
const root = 'public/sound-board-theme';
const themes = readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => ({
  ...JSON.parse(readFileSync(`${root}/${entry.name}/manifest.json`, 'utf8')), folder: entry.name, preview: 'preview.wav',
}));
globalThis.__BOARD_SOUND_THEMES__ = themes;
const { SOUND_THEMES, resolveSoundTheme, boardSoundAsset, soundPreviewAsset } = await import('./src/soundThemes.ts');
assert.equal(SOUND_THEMES.length, themes.length);
for (const id of ['ceramic-drop', 'hush-organ', 'linen-pluck', 'muted-marimba']) assert(themes.some(theme => theme.id === id));
const events = { select: 'select', move: 'move', check: 'check', checkmate: 'checkmate', capture: 'capture-opponent', lost: 'piece-lost', 'en-passant': 'en-passant', castling: 'castle', timeout: 'timeout', win: 'win', lose: 'lose', invalid: 'invalid-move' };
let checked = 0;
for (const theme of themes) {
  assert.equal(resolveSoundTheme(theme.id), theme.id);
  assert(theme.defaultVolume >= 0 && theme.defaultVolume <= 1);
  for (const [action, event] of Object.entries(events)) {
    const asset = boardSoundAsset(theme.id, action);
    assert.equal(asset.url, `/sound-board-theme/${theme.folder}/${theme.events[event].file}`);
    assert.equal(asset.volume, theme.defaultVolume);
    const wav = readFileSync(`public${asset.url}`);
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
    assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
    checked++;
  }
  assert(existsSync(`public${soundPreviewAsset(theme.id).url}`));
}
assert.equal(resolveSoundTheme('crystal'), 'moonlit-glass');
assert.equal(resolveSoundTheme('soft-8bit'), 'velvet-arcade');
assert.equal(resolveSoundTheme('removed-theme'), 'moonlit-glass');
assert.equal(resolveSoundTheme(null), 'moonlit-glass');
console.log(`PASS ${themes.length} manifest-backed themes, ${checked} event mappings and WAV headers, previews, saved selections and legacy aliases`);
