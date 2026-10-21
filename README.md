# Arcade Chess

Arcade Chess is a responsive, 16-bit Amiga/demoscene-inspired chess game built with React, TypeScript, Vite, and `chess.js`. Choose an unlocked boss from the 100–3000 Elo ladder (50-point steps), then play on a separate battle screen.

## Run locally

```sh
npm install
npm run dev
```

Create a `.env.local` from `.env.example` to enable Supabase sign-in and cloud progress. Without it, the app works in guest mode and stores progress in this browser's local storage.

## Supabase setup

1. Create a Supabase project and copy its project URL and anon/publishable key into `.env.local` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
2. Run [`supabase/schema.sql`](supabase/schema.sql) in the Supabase SQL editor. It creates row-level security, idempotent atomic progress RPCs, and migrates existing saves to the 50-Elo ladder. Re-run it when upgrading an existing Supabase project.
3. Enable Google, Facebook, and GitHub providers in Supabase Authentication and configure each provider's OAuth credentials and callback URL.
4. Add your local and production app URLs to Supabase's redirect URL allow-list.

The browser uses only the Supabase anon key. Never put a service-role key in a `VITE_` variable.

## Game notes

- Insert Coin plays a random Bounce, Flip, or Rocket animation from `src/animations/coinInsert.ts`, with its matching WAV sound from `public/animations/coin-insert/`. Playback respects the sound-effects mute/volume controls and reduced-motion preference. Rapid clicks restart the animation while adding one credit each; leaving the home page stops playback. Run `node coin-insert-check.mjs` (or `--production` after building) to verify the integration. Executable animation code is bundled from `src`; `public` contains only static assets and their metadata/docs.
- Choose Standard chess or Freestyle chess (Chess960) on the challenger ladder before starting a new game. Freestyle randomly selects one of the 960 legal starting arrays: bishops on opposite colors, the king between the rooks, and matching back ranks for both sides. Pawns and normal chess rules stay the same.
- Standard and Freestyle have separate 59-rung ladders. Switching modes shows that ladder's cleared and unlocked opponents; wins unlock only the next opponent in the played mode. Existing progress belongs to Standard, while Freestyle starts at 100 Elo. Both counts persist locally and sync through the idempotent account RPCs; wins, losses, and streaks remain overall statistics. Re-run `supabase/schema.sql` before deploying this update to an existing Supabase project to migrate cloud progress and update the RPCs.
- Ladder verification: `node ladder-check.mjs` covers progression and migrations, and `node ladder-ui-check.mjs` covers mode switching and actual wins. To verify the cloud SQL in a local Postgres runtime, install its temporary test dependency with `npm install --prefix .tmp/ladder-check --no-package-lock @electric-sql/pglite`, then run `node ladder-cloud-check.mjs`.
- Standard chess uses `chess.js`; Freestyle uses `chessops` through `src/chess.ts`, including official Chess960 castling. Move the king onto its own rook to castle: the king/rook finish on g/f for kingside or c/d for queenside. Castling rights, empty paths, and king safety are enforced even when a king or rook stays on its starting square.
- Player pawn promotions open a chooser for queen, rook, bishop, or knight before committing the move. This also applies when a promotion premove becomes legal. Cancel or press Escape to keep the original position. Run `node promotion-ui-check.mjs` to verify both colors and modes, captures, drag moves, premoves, keyboard controls, and mobile layout.
- The battle board fits the available viewport height, including on ultrawide displays and after resizing the window. Desktop side panels scroll independently, and manually saved board sizes are capped to the available space. Run `node board-fit-check.mjs` to check Standard/Freestyle layouts, saved sizes, all 64 squares, panel collapse/scrolling, and phone landscape layouts.
- Freestyle mode and its exact starting position are included in saved games and PGN history, including bot play and game reviews. Run `node freestyle-check.mjs` to check all 960 setups, castling edge cases, other chess rules, bot legality, and archive/review regressions.
- The current match saves automatically after each player and boss move in this browser. Reloading the battle restores it; use Resume from the roster when returning later. Starting another match replaces the saved match, and finishing or resigning clears it.
- Boss-to-folder mappings are explicit in `src/bossArtwork.ts` and shared by both ladders. Folder matching also accepts punctuation, spacing, hyphen, and accent differences. PNG artwork is discovered from `public/characters/` on dev server startup or production build. Use `focused.png`, `angry.png`, `taunting.png`, `won.png`, and `lost.png`; missing expressions fall back to an available portrait. Empty or missing folders retain their mapping and use an arcade mascot until artwork is supplied. See `BOSS_ARTWORK_AUDIT.md`, or run `node boss-artwork-check.mjs --write` to refresh the audit.
- The current local opponent is a lightweight minimax/search prototype running in a Web Worker, with intentionally varied play. Boss ratings are progression targets, **not calibrated Elo ratings**. For reliable 100–3000 Elo opponents, replace `src/bot.ts` with Stockfish WebAssembly and tune/test each boss strength.
- Background music uses separate looping tracks from `public/music` for the landing page, boss selection, and chess battle. Board sound themes are discovered from the manifests in `public/sound-board-theme/` at dev-server startup or production build; their display names, event filenames, and volumes come from those manifests. UI arcade effects are synthesized with Web Audio. Music and sound effects have independent controls, and browsers may wait for the first user interaction before starting audio. Run `node sound-themes-check.mjs` and `node sound-themes-ui-check.mjs` to verify theme mappings, previews, audio decoding, and result cues.
- Guest scores remain on the current device. Signing in merges locally stored and account-stored counters; it does not provide an anti-cheat leaderboard. Failed cloud game results stay queued locally and retry on the next sign-in or when connectivity returns.
