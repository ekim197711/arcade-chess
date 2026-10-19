# Paper & Wood

Small dry wooden ticks with a trace of paper texture.

This folder is self-contained. Copy the whole `paper-wood` folder into your web application's `public/sounds/` directory.

## Browser module

```js
import sounds from '/sounds/paper-wood/index.js';

// Call inside a click/tap handler initially, to enable browser playback.
const audio = new Audio(sounds['move']);
audio.volume = 0.65;
audio.preload = 'auto';
audio.play().catch(console.error);
```

You can also copy the folder into your source assets directory and import its `index.js` with a relative path. It uses static `new URL(..., import.meta.url)` references for compatible bundlers.

## Direct asset use

No JavaScript module is required: use `/sounds/paper-wood/move.wav` directly with your existing audio system. Adjust the URL prefix if your app is hosted under a subpath.

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

`capture-opponent` means the human player takes an opponent's piece; `piece-lost` means the human player's piece is taken. `en-passant` is the special pawn capture.

Use a single cue per move: timeout > checkmate > check > en passant/castle > capture > move. Keep volume and mute controls available.

`preview.wav` plays all nine actions back-to-back without gaps in the order above and is optional for deployment. `manifest.json` contains relative filenames, durations, and audio metadata. All effects are original synthesized mono 24 kHz, 16-bit WAV files.
