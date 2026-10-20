# Arcade Chess

Arcade Chess is a responsive, 16-bit Amiga/demoscene-inspired chess game built with React, TypeScript, Vite, and `chess.js`. Choose an unlocked boss from the 100–3000 Elo ladder (50-point steps), then play on a separate battle screen.

## Run locally

```sh
npm install
npm run dev
```

Create a `.env.local` from `.env.example` to enable Supabase sign-in and cloud progress. Without it, the app works in guest mode and stores progress in this browser's local storage.

## Supabase setup

1. Copy your existing project's URL and **publishable key** into `.env.local` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. A legacy anon key in `VITE_SUPABASE_ANON_KEY` also works. Set only the key you use. Restart Vite after changing environment variables; set the same variables on your production host before building.
2. Run [`supabase/schema.sql`](supabase/schema.sql) in the Supabase SQL editor. It creates row-level security, idempotent atomic progress RPCs, and migrates existing saves to the 50-Elo ladder. Re-run it when upgrading an existing Supabase project.
3. In **Authentication ? Sign In / Providers**, enable Email and allow new sign-ups. Keep email confirmation enabled if you want new players to verify their email. Set the minimum password length to at least 8 (the form uses 8; stricter server rules are also shown to users).
4. Enable **Google**, **GitHub**, and **Facebook** in the same provider settings. Create the corresponding OAuth application in each provider's developer console, and save its client ID and secret **in Supabase**. Use the callback URL shown by Supabase, normally `https://<project-ref>.supabase.co/auth/v1/callback`, in each provider's authorized redirect/callback settings. Google also needs your app origin configured; Facebook apps must be available to their intended users rather than restricted to developer/test accounts.
5. In **Authentication ? URL Configuration**, set **Site URL** to your production app URL and add your exact development and production app URLs to **Redirect URLs** (for example `http://localhost:5173/` and `https://your-game.example/`). If hosted under a subdirectory, include that path. The app returns OAuth, confirmation, and recovery links to its base page and opens the new-password form on Supabase's `PASSWORD_RECOVERY` event.
6. Configure **custom SMTP** before opening email registration to the public. Supabase's built-in email service is restricted and intended for testing. Check confirmation and password reset email templates and delivery from a real inbox.

The browser uses only the public publishable/anon key. Never put a service-role key or OAuth client secret in a `VITE_` variable. Passwords are sent directly to Supabase Auth and are not stored by the game.

### Account flow

Open **JOIN / LOG IN** to create an account or sign in with Google, GitHub, Facebook, or email/password. Email signup supports an optional player name, password confirmation, and a confirmation-email message. Existing players can sign in or request a password reset. Recovery links open a new-password form even when Supabase creates an authenticated recovery session. Signed-in players retain the existing account progress sync and guest-progress merge. Guest play remains available without Supabase configuration.

### Verify your project

- Test each OAuth provider using a permitted test account, including cancelling the provider flow.
- Create an email account, confirm its email, sign out, and sign back in.
- Request a reset link and set a new password; confirm the old password no longer works.
- Play as a guest, sign in, and verify progress merges once and survives reload/sign-out/sign-in.
- If authentication works but progress reports a sync problem, verify the SQL schema and RPCs are installed in this same project.

Provider setup: [Google](https://supabase.com/docs/guides/auth/social-login/auth-google), [GitHub](https://supabase.com/docs/guides/auth/social-login/auth-github), [Facebook](https://supabase.com/docs/guides/auth/social-login/auth-facebook), [email/password](https://supabase.com/docs/guides/auth/passwords), [redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).

## Game notes

- Legal chess moves, check, checkmate, draws, move history, and promotions are handled by `chess.js`.
- The current local opponent is a lightweight minimax/search prototype running in a Web Worker, with intentionally varied play. Boss ratings are progression targets, **not calibrated Elo ratings**. For reliable 100–3000 Elo opponents, replace `src/bot.ts` with Stockfish WebAssembly and tune/test each boss strength.
- Background music uses separate looping tracks from `public/music` for the landing page, boss selection, and chess battle. Arcade sound effects are synthesized with the Web Audio API. Music and sound effects have independent controls, and browsers may wait for the first user interaction before starting audio.
- Guest scores remain on the current device. Signing in merges locally stored and account-stored counters; it does not provide an anti-cheat leaderboard. Failed cloud game results stay queued locally and retry on the next sign-in or when connectivity returns.
