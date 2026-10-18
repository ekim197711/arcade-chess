# Chess sounds — eight original themes

56 procedurally synthesized effects. No third-party samples. You may use, modify, and distribute these assets in your game, including commercial games; no attribution required.

Each theme folder contains `move.wav`, `capture.wav`, `check.wav`, `checkmate.wav`, `promotion.wav`, `en-passant.wav`, and `castling.wav`.

| Folder | Character |
| --- | --- |
| wooden-board | Dry wooden taps and knocks |
| crystal | Glass bells and shimmering chimes |
| retro-arcade | Pulse-wave bleeps and jingles |
| sci-fi | Electronic sweeps and sonar |
| royal-fanfare | Synthesized brass flourishes |
| soft-minimal | Gentle rounded plucks |
| felt-piano | Muted warm keys with soft attacks |
| quiet-pebbles | Low rounded taps with short tails |

Files are 44.1 kHz, 16-bit stereo PCM WAV with short fades and headroom. These are designed synthesized sounds, not recordings of physical chess pieces or instruments. Open `preview.html` to audition individual sounds. `all-themes-preview.wav` plays all themes in the table order, with events in the filename order above.

## JavaScript integration

Copy this folder into your game's public assets, e.g. `public/chess-sounds/`. Serve your game over HTTP. The included loader uses Web Audio for overlapping, preloaded playback.

```js
import { ChessSounds } from './chess-sounds/chess-sounds.js';

const sounds = new ChessSounds({
  baseUrl: '/chess-sounds/',
  theme: 'wooden-board',
  volume: 0.7,
});

document.querySelector('#start').addEventListener('click', async () => {
  await sounds.unlock(); // browser audio permission needs a user gesture
  await sounds.preload();
});

// Once unlocked and preloaded:
await sounds.play('move');
await sounds.play('promotion'); // pawn becomes queen, rook, bishop, or knight
await sounds.setTheme('crystal');
sounds.setVolume(0.5); // 0 mutes; 1 is maximum
```

Use one cue per completed turn to avoid overlapping event notifications. Suggested priority: checkmate > check > promotion > castling > en-passant > capture > move. Select the event after the chess rules engine has validated and applied the move. The loader does not implement chess rules.

For a minimal setup without the loader:

```js
const move = new Audio('/chess-sounds/wooden-board/move.wav');
// Run following a user interaction:
move.currentTime = 0;
await move.play();
```

`manifest.json` lists every asset and duration. To regenerate: install numpy and run `python generate.py`. The generator uses a fixed seed for reproducible synthesis.

The two subtle themes (`felt-piano` and `quiet-pebbles`) use lower pitches, gentler attacks, restrained reflections, and consonant event patterns. Their peak levels are approximately 8 dB below the original themes at the same volume setting. Felt Piano is synthesized, not a sampled piano.
