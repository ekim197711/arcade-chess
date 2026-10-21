import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readdirSync, readFileSync, existsSync } from 'node:fs';

// Keep public artwork at its original URLs while exposing available expressions
// to the app. New character folders are picked up on dev startup or production build.
const charactersRoot = new URL('./public/characters/', import.meta.url);
const bossPortraits = Object.fromEntries(
  readdirSync(charactersRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => [entry.name, readdirSync(new URL(`${entry.name}/`, charactersRoot), { withFileTypes: true })
      .filter(file => file.isFile() && file.name.endsWith('.png'))
      .map(file => file.name.slice(0, -4))]),
);

const soundThemesRoot = new URL('./public/sound-board-theme/', import.meta.url);
const requiredSoundEvents = ['select', 'move', 'check', 'checkmate', 'capture-opponent', 'piece-lost', 'en-passant', 'castle', 'timeout', 'win', 'lose', 'invalid-move'];
const boardSoundThemes = readdirSync(soundThemesRoot, { withFileTypes: true })
  .filter(entry => entry.isDirectory() && existsSync(new URL(`${entry.name}/manifest.json`, soundThemesRoot)))
  .map(entry => {
    const folder = new URL(`${entry.name}/`, soundThemesRoot);
    const manifest = JSON.parse(readFileSync(new URL('manifest.json', folder), 'utf8'));
    for (const event of requiredSoundEvents) {
      if (!manifest.events?.[event]?.file || !existsSync(new URL(manifest.events[event].file, folder))) {
        throw new Error(`Missing sound asset: ${entry.name}/${event}`);
      }
    }
    return { ...manifest, folder: entry.name, preview: existsSync(new URL('preview.wav', folder)) ? 'preview.wav' : undefined };
  })
  .sort((a, b) => a.name.localeCompare(b.name));
if (!boardSoundThemes.length) throw new Error('No board sound themes found');
if (new Set(boardSoundThemes.map(theme => theme.id)).size !== boardSoundThemes.length) throw new Error('Duplicate board sound theme IDs');

export default defineConfig({
  plugins: [react()],
  define: {
    __BOSS_PORTRAITS__: JSON.stringify(bossPortraits),
    __BOARD_SOUND_THEMES__: JSON.stringify(boardSoundThemes),
  },
});
