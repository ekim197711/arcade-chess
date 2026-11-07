# The grill-bar jukebox

Six original, procedurally composed instrumentals for Arcade Gambit. No external recordings, samples, borrowed tunes or voice performances are used. The arrangements combine synthesized muted guitar, electric piano, organ, walking bass, brushed drums, shuffle rhythms, small-room reflections, gentle saturation and quiet record noise.

| Area | Song | Tempo | Duration |
| --- | --- | --- | --- |
| Home, settings, history and Legendary matches | Last Booth Blues | 78 BPM | 1:53 |
| Home, settings, history and Legendary matches | Neon After Midnight | 72 BPM | 1:49 |
| Boss selection | Grease-stained 45 | 94 BPM | 1:34 |
| Boss selection | Chrome & Coffee | 96 BPM | 1:32 |
| Boss and online battles | Quarter Slot Shuffle | 108 BPM | 1:22 |
| Boss and online battles | Backroom Boogie | 104 BPM | 1:26 |

Each area starts at a random song and alternates between its pair on completion. Page interactions do not restart the music. Muting or hiding the page pauses playback; returning resumes it. Settings includes a Next song button and independent music volume. Browser autoplay restrictions are respected, and no soundtrack is downloaded before a user interaction with music enabled.

The source composition is `scripts/compose-jukebox.py`. To regenerate, install `numpy` and `lameenc` in your Python environment, then run `python scripts/compose-jukebox.py` from the project root. Fixed seeds make the arrangement reproducible. The renderer writes 128 kbps stereo MP3s plus duration, tempo and level measurements in `manifest.json`. Keep `src/jukeboxTracks.ts` aligned if adding or renaming songs. The previous soundtrack remains on disk but is no longer selected by the player.

Verification: `node jukebox-music-check.mjs`, `node jukebox-music-ui-check.mjs`, and `npm run build`. The browser test checks decoding and actual playback of the rendered MP3s and advances the audio clock to verify automatic rotation.
