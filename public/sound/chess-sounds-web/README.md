# Chess sounds — eight original themes

56 procedurally synthesized effects. No third-party samples. You may use, modify, and distribute these assets in your game, including commercial games; no attribution required.

Each theme folder contains `move.mp3`, `capture.mp3`, `check.mp3`, `checkmate.mp3`, `promotion.mp3`, `en-passant.mp3`, and `castling.mp3`.

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

Files are 44.1 kHz stereo MP3 at 96 kbps, encoded from the original WAV masters with their relative volumes preserved. MP3 is lossy; very short files may have a small amount of trailing encoder padding. These are designed synthesized sounds, not recordings of physical chess pieces or instruments. Open `preview.html` to audition individual sounds.

## JavaScript integration

Copy the `chess-sounds` folder from this ZIP into your game's public assets, e.g. `public/chess-sounds/`. Serve your game over HTTP. The included loader uses Web Audio for overlapping, preloaded playback.

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
const move = new Audio('/chess-sounds/wooden-board/move.mp3');
// Run following a user interaction:
move.currentTime = 0;
await move.play();
```

`manifest.json` lists every asset and duration. The WAV masters and synthesis source remain in the separate original sound pack.

The two subtle themes (`felt-piano` and `quiet-pebbles`) use lower pitches, gentler attacks, restrained reflections, and consonant event patterns. Their peak levels are approximately 8 dB below the original themes at the same volume setting. Felt Piano is synthesized, not a sampled piano.
