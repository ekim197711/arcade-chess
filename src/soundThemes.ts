export type SoundThemeManifest = {
  id: string;
  folder: string;
  name: string;
  description: string;
  defaultVolume: number;
  events: Record<string, { file: string; duration: number }>;
  preview?: string;
};

export const SOUND_THEMES = __BOARD_SOUND_THEMES__;
export type SoundTheme = string;
export type BoardSound = "select" | "move" | "check" | "checkmate" | "capture" | "lost" |
  "en-passant" | "castling" | "timeout" | "win" | "lose" | "invalid";

const EVENT_NAMES: Record<BoardSound, string> = {
  select: "select", move: "move", check: "check", checkmate: "checkmate",
  capture: "capture-opponent", lost: "piece-lost", "en-passant": "en-passant",
  castling: "castle", timeout: "timeout", win: "win", lose: "lose", invalid: "invalid-move",
};
const LEGACY_THEMES: Record<string, string> = {
  crystal: "moonlit-glass", "felt-garden": "bamboo-garden", "quiet-pebbles": "paper-wood",
  "retro-arcade": "velvet-arcade", "royal-fanfare": "felt-piano", "sci-fi": "orbital-drift",
  "soft-minimal": "bamboo-garden", "wooden-board": "paper-wood",
  "glass-orbit": "moonlit-glass", "rainy-cafe": "felt-piano", woodland: "paper-wood",
  "moon-chimes": "moonlit-glass", "soft-8bit": "velvet-arcade",
};

export function resolveSoundTheme(saved: string | null): SoundTheme {
  const requested = saved && (LEGACY_THEMES[saved] ?? saved);
  return SOUND_THEMES.find(theme => theme.id === requested)?.id
    ?? SOUND_THEMES.find(theme => theme.id === "velvet-arcade")?.id
    ?? SOUND_THEMES[0]!.id;
}

export function soundTheme(theme: SoundTheme): SoundThemeManifest {
  return SOUND_THEMES.find(item => item.id === resolveSoundTheme(theme))!;
}

export function boardSoundAsset(theme: SoundTheme, event: BoardSound) {
  const manifest = soundTheme(theme);
  const sound = manifest.events[EVENT_NAMES[event]]!;
  return {
    url: `/sound-board-theme/${encodeURIComponent(manifest.folder)}/${encodeURIComponent(sound.file)}`,
    volume: manifest.defaultVolume,
  };
}

export function soundPreviewAsset(theme: SoundTheme) {
  const manifest = soundTheme(theme);
  return manifest.preview ? {
    url: `/sound-board-theme/${encodeURIComponent(manifest.folder)}/${encodeURIComponent(manifest.preview)}`,
    volume: manifest.defaultVolume,
  } : undefined;
}
