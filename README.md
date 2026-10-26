# Arcade Gambit

Arcade Gambit is a responsive, 16-bit Amiga/demoscene-inspired chess game built with React, TypeScript, Vite, and `chess.js`. Choose an unlocked boss from the 100–3000 Elo ladder (50-point steps), then play on a separate battle screen.

## Run locally

```sh
npm install
npm run dev
```

Create a `.env.local` from `.env.example` to enable Supabase sign-in and cloud progress. Without it, the app works in guest mode and stores progress in this browser's local storage.

## Supabase setup

1. Set separate development and production URLs and publishable keys in `.env.local`, using the four variables in `.env.example`. Localhost, `.localhost`, `.local`, loopback, and private LAN IP addresses use `VITE_SUPABASE_DEV_URL` and `VITE_SUPABASE_DEV_PUBLISHABLE_KEY`. Public domains, including `https://arcadegambit.com` and `www.arcadegambit.com`, use `VITE_SUPABASE_PROD_URL` and `VITE_SUPABASE_PROD_PUBLISHABLE_KEY`. Selection uses the browser hostname, including when previewing a production build locally. Missing development settings keep localhost in guest mode; it never falls back to production. Development and production cannot point at the same Supabase origin. Legacy `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`/`VITE_SUPABASE_ANON_KEY` are accepted only for production. Restart Vite after changing environment files; set the same variables in your hosting build environment and rebuild when deploying.
2. Run [`supabase/schema.sql`](supabase/schema.sql) in each environment's Supabase SQL editor. It creates row-level security, idempotent atomic progress RPCs, the account game archive and save RPC, and migrates existing progression. Re-run it when upgrading an existing Supabase project.
3. Enable Google, Facebook, and GitHub providers in Supabase Authentication and configure each provider's OAuth credentials and callback URL.
4. Allow localhost/LAN app redirect URLs only in development Supabase. Allow `https://arcadegambit.com` (and any supported public domains) in production Supabase. Configure OAuth providers separately for each environment.

The browser uses only the Supabase publishable/anon key. Never put a service-role key in a `VITE_` variable.

Configured cloud environments:

| Environment | Supabase project | Project reference | App URLs |
| --- | --- | --- | --- |
| Development | arcade-chess-development | `nlwtzggjjbacndirlggj` | localhost and 127.0.0.1, on any local port |
| Production | arcade-chess | `smdwmvfkyumxuxbnzitq` | arcadegambit.com and www.arcadegambit.com over HTTPS |

Both projects have the progress/history schema and RLS policies applied. Their publishable keys are stored in the ignored `.env.local` file. The development database password is stored encrypted with Windows DPAPI in `.tmp/supabase-development-password.dpapi` for this Windows account. OAuth providers still need their client IDs/secrets configured separately in each project's Authentication settings; the application has Google, Facebook, and GitHub buttons, but the database setup does not create those provider applications. For local LAN testing, add the exact LAN callback URL to the development project's redirect allow-list.

Apply future schema updates with an explicit project reference, after testing against development:

```sh
supabase db query --linked --project-ref nlwtzggjjbacndirlggj --file supabase/schema.sql
supabase db query --linked --project-ref smdwmvfkyumxuxbnzitq --file supabase/schema.sql
```

Signed-in games save every committed move to `player_games`, including full Standard or Chess960 PGN, opponent, player color, and result. History includes **Resume game** for every unfinished match and **Review** for all games. Local account caches retain offline saves; uploads retry on reconnect, focus, and every 15 seconds. History loads in pages so older games remain available. Guest history is claimed by the first account that signs in on that browser and then removed from the guest archive. Account histories are isolated by user ID, with RLS enforcing cloud access. Signed-in profile pictures use OAuth avatar metadata, with initials if no image is available.

The save RPC prevents stale positions with fewer moves from overwriting newer ones and preserves completed results. Simultaneous play of the same match on multiple devices is not a collaborative game session; continue a match on one device at a time.

## Game notes

- Insert Coin plays a random Bounce, Flip, or Rocket animation from `src/animations/coinInsert.ts`, with its matching WAV sound from `public/animations/coin-insert/`. Playback respects the sound-effects mute/volume controls and reduced-motion preference. Rapid clicks restart the animation while adding one credit each; leaving the home page stops playback. Run `node coin-insert-check.mjs` (or `--production` after building) to verify the integration. Executable animation code is bundled from `src`; `public` contains only static assets and their metadata/docs.
- Choose Standard chess or Freestyle chess (Chess960) on the challenger ladder before starting a new game. Freestyle randomly selects one of the 960 legal starting arrays: bishops on opposite colors, the king between the rooks, and matching back ranks for both sides. Pawns and normal chess rules stay the same.
- Standard and Freestyle have separate 59-rung ladders. Switching modes shows that ladder's cleared and unlocked opponents; wins unlock only the next opponent in the played mode. Existing progress belongs to Standard, while Freestyle starts at 100 Elo. Both counts persist locally and sync through the idempotent account RPCs; wins, losses, and streaks remain overall statistics. Re-run `supabase/schema.sql` before deploying this update to an existing Supabase project to migrate cloud progress and update the RPCs.
- Settings → Debug mode unlocks every boss in both ladders and adds an Auto checkmate button during battles. The button simulates an immediate player victory for testing the full result screen, cancels any pending engine search, and keeps the original PGN. Debug matches retain their test marker when saved/resumed, appear as debug tests in history, and do not update local/account statistics or ladder progress. Debug mode defaults off and is saved on this device. Run `node debug-mode-check.mjs` to check unlocks, persistence, both game modes, simulated victories, and normal locks after disabling it.
- Ladder verification: `node ladder-check.mjs` covers progression and migrations, and `node ladder-ui-check.mjs` covers mode switching and actual wins. To verify the cloud SQL in a local Postgres runtime, install its temporary test dependency with `npm install --prefix .tmp/ladder-check --no-package-lock @electric-sql/pglite`, then run `node ladder-cloud-check.mjs`.
- Standard chess uses `chess.js`; Freestyle uses `chessops` through `src/chess.ts`, including official Chess960 castling. Move the king onto its own rook to castle: the king/rook finish on g/f for kingside or c/d for queenside. Castling rights, empty paths, and king safety are enforced even when a king or rook stays on its starting square.
- Player pawn promotions open a chooser for queen, rook, bishop, or knight before committing the move. This also applies when a promotion premove becomes legal. Cancel or press Escape to keep the original position. Run `node promotion-ui-check.mjs` to verify both colors and modes, captures, drag moves, premoves, keyboard controls, and mobile layout.
- The battle board fits the available viewport height, including on ultrawide displays and after resizing the window. Desktop side panels scroll independently, and manually saved board sizes are capped to the available space. Run `node board-fit-check.mjs` to check Standard/Freestyle layouts, saved sizes, all 64 squares, panel collapse/scrolling, and phone landscape layouts.
- Freestyle mode and its exact starting position are included in saved games and PGN history, including bot play and game reviews. Run `node freestyle-check.mjs` to check all 960 setups, castling edge cases, other chess rules, bot legality, and archive/review regressions.
- The current match saves automatically after each player and boss move in this browser. Reloading the battle restores it; use Resume from the roster when returning later. Starting another match replaces the saved match, and finishing or resigning clears it.
- Boss-to-folder mappings are explicit in `src/bossArtwork.ts` and shared by both ladders. Folder matching also accepts punctuation, spacing, hyphen, and accent differences. PNG artwork is discovered from `public/characters/` on dev server startup or production build. Use `focused.png`, `angry.png`, `taunting.png`, `won.png`, and `lost.png`; missing expressions fall back to an available portrait. Empty or missing folders retain their mapping and use an arcade mascot until artwork is supplied. See `BOSS_ARTWORK_AUDIT.md`, or run `node boss-artwork-check.mjs --write` to refresh the audit.
- Boss moves use Stockfish.js 19.0.1 (Stockfish 19 lite, single-threaded WASM). Before **every move**, the engine advertises its Elo range, receives `UCI_LimitStrength=true` and the boss's `UCI_Elo`, and acknowledges readiness before search. The full game move history and `UCI_Chess960` are passed through. Native Elo support is 1320–3190; bosses from 1350–3000 use their displayed rating directly. The 100–1300 beginner targets use Stockfish at its native floor, depth 4 with all legal candidates, and additional weighted mistakes; these are approximate targets, not calibrated human ratings. Higher bosses search for 1.5 seconds per move; actual strength depends on the device, position, and time control. Engine failures pause for an explicit retry instead of playing random moves. Review analysis still uses the lightweight local review engine. Run `node stockfish-check.mjs` to verify strength settings, real engine moves, and error recovery; run it with `--production` after building to verify the deployed assets.
- Background music uses separate looping tracks from `public/music` for the landing page, boss selection, and chess battle. Board sound themes are discovered from the manifests in `public/sound-board-theme/` at dev-server startup or production build; their display names, event filenames, and volumes come from those manifests. UI arcade effects are synthesized with Web Audio. Music and sound effects have independent controls, and browsers may wait for the first user interaction before starting audio. Run `node sound-themes-check.mjs` and `node sound-themes-ui-check.mjs` to verify theme mappings, previews, audio decoding, and result cues.
- Guest scores remain on the current device. Signing in merges locally stored and account-stored counters; it does not provide an anti-cheat leaderboard. Failed cloud game results stay queued locally and retry on the next sign-in or when connectivity returns.
