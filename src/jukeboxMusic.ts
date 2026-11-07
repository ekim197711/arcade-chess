import { JUKEBOX_TRACKS, musicSource, type MusicTrack } from "./jukeboxTracks.ts";
export type { MusicTrack } from "./jukeboxTracks.ts";

/** One player for the app; songs advance only at their end or an explicit skip. */
export function createJukebox(createAudio: () => HTMLAudioElement = () => new Audio(), isHidden: () => boolean = () => document.hidden, random: () => number = Math.random) {
  let audio: HTMLAudioElement | null = null;
  let scene: MusicTrack = "home";
  let volume = .7;
  let wanted = false;
  let attempt = 0;
  let pending = false;
  let selected: typeof JUKEBOX_TRACKS[number] | undefined;
  const cursors = new Map<MusicTrack, number>();
  const listeners = new Set<() => void>();

  function select(advance: boolean) {
    const tracks = JUKEBOX_TRACKS.filter(track => track.scene === scene);
    const previous = cursors.get(scene);
    const cursor = previous === undefined ? Math.floor(random() * tracks.length) : (previous + (advance ? 1 : 0)) % tracks.length;
    cursors.set(scene, cursor);
    selected = tracks[cursor];
    if (audio) {
      audio.pause();
      audio.src = musicSource(selected.id);
      audio.load();
    }
    listeners.forEach(listener => listener());
  }
  function play() {
    if (!audio || !wanted || isHidden() || pending || (!audio.paused && !audio.ended)) return;
    const request = ++attempt;
    pending = true;
    void audio.play().catch(() => {
      // Autoplay may be blocked. The next user gesture can retry this song.
    }).finally(() => {
      if (request === attempt) pending = false;
    });
  }
  function start(nextScene: MusicTrack = scene) {
    if (isHidden()) return;
    wanted = true;
    if (!audio) {
      audio = createAudio();
      audio.loop = false;
      audio.preload = "none";
      audio.volume = .3 * volume;
      audio.addEventListener("ended", () => {
        if (!wanted || isHidden()) return;
        pending = false;
        select(true);
        play();
      });
    }
    if (!selected || scene !== nextScene) {
      attempt++;
      pending = false;
      scene = nextScene;
      select(true);
    } else if (audio.ended) {
      select(true);
    }
    play();
  }
  function stop() {
    wanted = false;
    attempt++;
    pending = false;
    audio?.pause();
  }
  return {
    start, stop,
    next(nextScene: MusicTrack = scene) {
      if (!selected || nextScene !== scene) { start(nextScene); return; }
      attempt++;
      pending = false;
      select(true);
      wanted = true;
      play();
    },
    setVolume(value: number) {
      volume = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
      if (audio) audio.volume = .3 * volume;
    },
    isPlaying: () => wanted && !!audio && (!audio.paused || pending),
    getTitle: () => selected?.title ?? "",
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
}

export const arcadeJukebox = createJukebox();
