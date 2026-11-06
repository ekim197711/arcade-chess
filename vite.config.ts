import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, relative, isAbsolute } from 'node:path';
import { createBuildInfo } from './scripts/buildInfo.ts';

const appBuild = createBuildInfo(fileURLToPath(new URL('.', import.meta.url)));

// Keep public artwork at its original URLs while exposing available expressions
// to the app. Refresh the dev inventory when character images are added or removed.
const charactersRoot = new URL('./public/characters/', import.meta.url);
const stockfishAssets = [
  { name: 'stockfish-19-lite-single.js', path: './node_modules/stockfish/bin/stockfish-19-lite-single.js', type: 'text/javascript' },
  { name: 'stockfish-19-lite-single.wasm', path: './node_modules/stockfish/bin/stockfish-19-lite-single.wasm', type: 'application/wasm' },
  { name: 'Copying.txt', path: './node_modules/stockfish/Copying.txt', type: 'text/plain' },
];
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
  plugins: [react(), {
    name: 'app-build-info',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'build-info.json', source: JSON.stringify(appBuild, null, 2) + '\n' });
    },
  }, {
    name: 'stockfish-assets',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const asset = stockfishAssets.find(asset => request.url?.split('?')[0] === `/stockfish/${asset.name}`);
        if (!asset) { next(); return; }
        response.setHeader('Content-Type', asset.type);
        response.end(readFileSync(new URL(asset.path, import.meta.url)));
      });
    },
    generateBundle() {
      for (const asset of stockfishAssets) this.emitFile({ type: 'asset', fileName: `stockfish/${asset.name}`, source: readFileSync(new URL(asset.path, import.meta.url)) });
      this.emitFile({ type: 'asset', fileName: 'stockfish/SOURCE.txt', source: 'Unmodified Stockfish.js 19.0.1 (lite single-threaded WASM). GPL v3.\nCorresponding source and build instructions: https://github.com/nmrugg/stockfish.js/tree/v19.0.1\nSource archive: https://github.com/nmrugg/stockfish.js/archive/refs/tags/v19.0.1.tar.gz\nPackage: https://www.npmjs.com/package/stockfish/v/19.0.1\nLicense: Copying.txt\n' });
    },
  }, {
    name: 'refresh-boss-artwork',
    configureServer(server) {
      const artworkRoot = fileURLToPath(charactersRoot);
      let timer: ReturnType<typeof setTimeout> | undefined;
      const refresh = (file: string) => {
        const path = relative(artworkRoot, resolve(file));
        if (path.startsWith('..') || isAbsolute(path) || !path.toLowerCase().endsWith('.png')) return;
        clearTimeout(timer);
        timer = setTimeout(() => {
          void server.restart().catch(error => server.config.logger.error(String(error)));
        }, 150);
      };
      server.watcher.on('add', refresh);
      server.watcher.on('unlink', refresh);
      server.httpServer?.once('close', () => {
        clearTimeout(timer);
        server.watcher.off('add', refresh);
        server.watcher.off('unlink', refresh);
      });
    },
  }],
  define: {
    __APP_BUILD__: JSON.stringify(appBuild),
    __BOSS_PORTRAITS__: JSON.stringify(bossPortraits),
    __BOARD_SOUND_THEMES__: JSON.stringify(boardSoundThemes),
  },
});
