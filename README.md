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

- Legal chess moves, check, checkmate, draws, move history, and promotions are handled by `chess.js`.
- The current match saves automatically after each player and boss move in this browser. Reloading the battle restores it; use Resume from the roster when returning later. Starting another match replaces the saved match, and finishing or resigning clears it.
- The current local opponent is a lightweight minimax/search prototype running in a Web Worker, with intentionally varied play. Boss ratings are progression targets, **not calibrated Elo ratings**. For reliable 100–3000 Elo opponents, replace `src/bot.ts` with Stockfish WebAssembly and tune/test each boss strength.
- Background music uses separate looping tracks from `public/music` for the landing page, boss selection, and chess battle. Arcade sound effects are synthesized with the Web Audio API. Music and sound effects have independent controls, and browsers may wait for the first user interaction before starting audio.
- Guest scores remain on the current device. Signing in merges locally stored and account-stored counters; it does not provide an anti-cheat leaderboard. Failed cloud game results stay queued locally and retry on the next sign-in or when connectivity returns.
