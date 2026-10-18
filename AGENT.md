# Agent Guide

## Product purpose

Arcade Chess is a browser-based chess arcade: players first choose a cartoon boss from a one-per-row ladder, then enter a separate chess battle screen. Keep the experience simple, focused, and styled like a polished dark 16-bit Amiga/demoscene game—not a generic chess dashboard.

## Product requirements and direction

- **Boss ladder:** 59 rungs, from 100 to 3000 Elo in increments of 50. The selected/current rung is brought into view automatically. Winning clears the rung and unlocks the next one.
- **Bosses:** Each rung has a distinct name, rating, palette/personality, animated portrait, and rotating taunts that jokingly insult the player. Keep the tone playful rather than hateful or personal.
- **Visual style:** Keep the dark, near-black Amiga-inspired look with cobalt/cyan/magenta/lime accents, pixel details, beveled panels, copper-bar effects, and animated sprites. Keep the board easy to distinguish from its surroundings and respect reduced-motion preferences.
- **Chess:** Legal moves, check/checkmate/draws, history, and promotion use `chess.js`. The player controls White; the bot controls Black. Captures have a short animated duel/effect and sound.
- **Audio:** Background music uses distinct looping tracks from `public/music` for the landing page, boss ladder, and chess battle. Sound effects are synthesized with the Web Audio API; music and sound effects have independent controls. Respect browser autoplay restrictions.
- **Accounts:** Optional Google, Facebook, and GitHub OAuth and cloud progress use Supabase. Guest progress works without configuration and is stored locally. See `.env.example`, `README.md`, and `supabase/schema.sql` for setup.
- **Future scope:** Human multiplayer is not implemented. Keep game state and move validation structured so authoritative online play can be added separately later.

## Architecture

- `src/App.tsx`: app UI, ladder/progression, game flow, auth and progress sync.
- `src/bot.ts`: local lightweight minimax/search opponent.
- `src/bot.worker.ts`: runs bot search off the UI thread; the UI has a legal-move fallback if worker startup fails.
- `src/styles.css`: base layout and component styling.
- `src/amiga.css`: Amiga/demoscene graphics and ladder layout/animation.
- `src/light.css`: layout and component styles for the newer home, ladder, and battle UI; imported before `src/amiga.css`, which applies the dark Amiga palette.
- `supabase/schema.sql`: row-level security, atomic/idempotent progress RPCs, and progression migration.

## Important behavior and data rules

- Boss ratings are **progression labels, not calibrated Elo strengths**. The current local bot is a prototype, not a production-strength engine. Do not claim that a 100 or 3000 label corresponds to a real rating; Stockfish WebAssembly would be needed for dependable strength calibration.
- `bossesDefeated` is the number of ladder rungs cleared (0–59); rung indexes are 0–58. Keep unlock checks, profile migration, and database limits aligned.
- Progress has `progressionVersion: 2`. If changing ladder size, rung spacing, or index semantics, update together: boss generation, client migration constants in `src/App.tsx`, `supabase/schema.sql` migration/defaults/RPC validation, and this documentation.
- Cloud game results and guest merges must continue using the idempotent RPCs. Avoid replacing them with whole-object client upserts, which can lose concurrent updates. Preserve/retry queued local events.
- Never put a Supabase service-role key in frontend code or a `VITE_` variable. Only the public anon/publishable key belongs in the browser.
- Guest saves are local browser storage, not cookies. Account progress is isolated by user ID.

## Development and verification

- Install dependencies with `npm install`.
- Run locally with `npm run dev`.
- Validate production output with `npm run build` and dependency advisories with `npm audit`.
- If changing chess/bot logic, smoke-test that the bot returns legal moves at low and high settings. If changing ladder/progress behavior, verify 100, 150, 2950, and 3000 Elo indexing and account/guest migration.
- Make focused changes, preserve TypeScript strictness, keep mobile layouts usable, and retain keyboard accessibility and reduced-motion support.
