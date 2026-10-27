# Agent Guide

## Product purpose

Arcade Gambit is a browser-based chess arcade: players first choose a cartoon boss from a one-per-row ladder, then enter a separate chess battle screen. Keep the experience simple, focused, and styled like a polished dark 16-bit Amiga/demoscene game—not a generic chess dashboard.

## Product requirements and direction

- **Boss ladders:** Standard and Freestyle have independent 59-rung ladders, from 100 to 3000 Elo in increments of 50. The selected/current rung is brought into view automatically. Winning clears the rung and unlocks the next one only in that game's mode.
- **Bosses:** Each rung has a distinct name, rating, palette/personality, animated portrait, and rotating taunts that jokingly insult the player. Keep the tone playful rather than hateful or personal.
- **Visual style:** Keep the dark, near-black Amiga-inspired look with cobalt/cyan/magenta/lime accents, pixel details, beveled panels, copper-bar effects, and animated sprites. Keep the board easy to distinguish from its surroundings and respect reduced-motion preferences.
- **Chess:** Legal moves, check/checkmate/draws, history, and promotion use `chess.js`. The player controls White; the bot controls Black. Captures have a short animated duel/effect and sound.
- **Audio:** Background music uses distinct looping tracks from `public/music` for the landing page, boss ladder, and chess battle. Board effects and previews use the WAV files declared by manifests in `public/sound-board-theme/`, through `src/soundThemes.ts`; UI effects use Web Audio synthesis. Keep both sound selectors aligned with the manifest inventory. Music and sound effects have independent controls. Respect browser autoplay restrictions.
- **Accounts:** Optional Google OAuth or email/password accounts and cloud progress use Supabase. Only Google and email sign-in providers should be enabled. Email signup requires confirmation; password recovery returns to the app to set a new password. Guest progress works without configuration and is stored locally. See `.env.example`, `README.md`, and `supabase/schema.sql` for setup.
- **Human multiplayer:** Signed-in players choose 3, 5, 10 or 15 minutes per side (no increment). Match the nearest available overall online Elo within the same time control; after 20 seconds, fall back to unrated server-owned bot practice. Human and fallback games share ladder board styling, drag, size, piece/board/sound selectors, battle music, and legal-at-execution cancelable premoves. A disconnected player has 20 seconds to return before forfeiting; clocks continue, the server checks deadlines before refreshing presence, and heartbeats never change move versions. Supabase validates moves, owns clocks and commits results/ratings atomically. Completed online games are visible to other signed-in players; existing boss archives remain private.

## Architecture

- `src/App.tsx`: app UI, ladder/progression, game flow, auth and progress sync.
- `src/CoinInsertAnimation.tsx`: home-page integration of the public coin-insert animation component and its matching audio; preserves credit accounting, mute/volume controls, and navigation cleanup.
- `src/progress.ts`: independent ladder counts, legacy migrations, guest merges, and queued result application.
- `src/bot.ts`: local lightweight minimax/search opponent.
- `src/bot.worker.ts`: runs bot search off the UI thread; the UI has a legal-move fallback if worker startup fails.
- `src/OnlinePlay.tsx`, `src/onlineChess.ts`, `src/online.css`: human matchmaking, both clocks, online board, reconnect/resume, and personal/community history.
- `supabase/multiplayer.sql`, `supabase/functions/multiplayer/`: server-only pairing, legal Standard chess, authoritative clock/result transactions, internal online Elo and practice bot. Apply the SQL after `schema.sql`, then deploy the function in each environment.
- `src/styles.css`: base layout and component styling.
- `src/amiga.css`: Amiga/demoscene graphics and ladder layout/animation.
- `src/light.css`: layout and component styles for the newer home, ladder, and battle UI; imported before `src/amiga.css`, which applies the dark Amiga palette.
- `supabase/schema.sql`: row-level security, atomic/idempotent progress RPCs, and progression migration.

## Important behavior and data rules

- Boss ratings are **progression labels, not calibrated Elo strengths**. The current local bot is a prototype, not a production-strength engine. Do not claim that a 100 or 3000 label corresponds to a real rating; Stockfish WebAssembly would be needed for dependable strength calibration.
- `bossesDefeated` counts Standard rungs cleared and `freestyleBossesDefeated` counts Freestyle rungs cleared (each 0–59); rung indexes are 0–58. Wins/losses and streak statistics remain account totals. Keep unlock checks, profile migration, and database limits aligned.
- Progress has `progressionVersion: 3`. Previous shared-ladder clears migrate to Standard; Freestyle starts at zero. Pending events carry their mode; events without a mode belong to Standard. If changing ladder size, rung spacing, or index semantics, update together: boss generation, client migration constants in `src/progress.ts`, `supabase/schema.sql` migration/defaults/RPC validation, and this documentation.
- Cloud game results and guest merges must continue using the idempotent RPCs. Avoid replacing them with whole-object client upserts, which can lose concurrent updates. Preserve/retry queued local events.
- Never put a Supabase service-role key in frontend code or a `VITE_` variable. Only the public anon/publishable key belongs in the browser.
- Guest saves are local browser storage, not cookies. Account progress is isolated by user ID.
- Debug mode and its Settings option are development-only: exactly `localhost` or `127.0.0.1` as the URL hostname. Every other hostname forces debug off, ignoring a saved enabled preference and refusing to restore saved debug matches.
- Online Elo is separate from review estimates and ladder labels. It starts at 1200 and uses FIDE rapid/blitz scoring probabilities and adult K coefficients, applied per game. It is not an official FIDE rating. Bot games never change human Elo. Never expose service-role credentials or grant clients direct writes to online games, queues, seats, or ratings.
- Online player moves render optimistically with immediate sound; reconcile against the confirmed move prefix and restore the server position on rejection. Never blindly resend an uncertain move or finalize results/ratings locally. Home-card status inspections must not renew presence; show resume, confirmed resignation, and the server-timed auto-resign countdown. Finished online matches show a summary with both players' accuracy using the same engine/cache as review, plus review and same-clock matchmaking actions.

## Development and verification

- Install dependencies with `npm install`.
- Run locally with `npm run dev`.
- Validate production output with `npm run build` and dependency advisories with `npm audit`.
- If changing chess/bot logic, smoke-test that the bot returns legal moves at low and high settings. If changing ladder/progress behavior, verify 100, 150, 2950, and 3000 Elo indexing and account/guest migration.
- Make focused changes, preserve TypeScript strictness, keep mobile layouts usable, and retain keyboard accessibility and reduced-motion support.
