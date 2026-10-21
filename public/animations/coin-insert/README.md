# Cartoon coin insert assets

Three short, non-looping close-up animations of shiny chess coins entering a chrome coin slot, with matching original WAV sound effects.

| Variant | Duration | Coin meets slot | Motion / sound |
| --- | --- | --- | --- |
| bounce | 0.95 s | 0.32 s | Bouncing pawn, spring blips, metal clink, credit jingle |
| flip | 1.00 s | 0.36 s | Spinning knight, sparkle ticks, metal clink, bright chime |
| rocket | 0.85 s | 0.25 s | Accelerating rook, rising whoosh, metal clink, power-up |

## App integration

The animation implementation is TypeScript in `src/animations/coinInsert.ts`, bundled by Vite. `src/CoinInsertAnimation.tsx` integrates it with the front page, chooses a random variant per coin, and handles volume, mute, rapid replays, and navigation cleanup.

This public folder contains the three WAV files and a reference preview image. There are no standalone JavaScript modules or demo pages to deploy.

Audio uses `/animations/coin-insert/bounce.wav`, `flip.wav`, and `rocket.wav`. Keep their names aligned with the variants in the source module. Files are mono, 24 kHz, 16-bit PCM WAV.

Run `node coin-insert-check.mjs` to check the development integration, or build the app and run `node coin-insert-check.mjs --production` to verify deployed assets and bundled code.
