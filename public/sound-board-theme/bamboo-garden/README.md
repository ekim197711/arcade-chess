# Bamboo Garden

Short hollow bamboo taps with soft edges.

The game discovers this theme through its `manifest.json`. Mapping and playback live in `src/soundThemes.ts` and `src/App.tsx`.

## Direct asset use

No JavaScript module is required: use `/sound-board-theme/bamboo-garden/move.wav` directly with your existing audio system. Adjust the URL prefix if your app is hosted under a subpath.

## Event filenames

- `select.wav`
- `move.wav`
- `check.wav`
- `checkmate.wav`
- `capture-opponent.wav`
- `piece-lost.wav`
- `en-passant.wav`
- `castle.wav`
- `timeout.wav`
- `win.wav`
- `lose.wav`
- `invalid-move.wav`

`capture-opponent` means the human player takes an opponent's piece; `piece-lost` means the human player's piece is taken. `en-passant` is the special pawn capture.

Use a single board cue per move: checkmate > check > en passant/castle > capture > move. Selection and invalid moves are separate interactions. `win` and `lose` are game results relative to the human player; play them when showing the result, after the board cue finishes. `timeout` can accompany the clock expiring. Keep volume and mute controls available.

`preview.wav` plays all twelve actions back-to-back without gaps in the order above and is optional for deployment. `manifest.json` contains relative filenames, durations, and audio metadata. All effects are original synthesized mono 24 kHz, 16-bit WAV files.
