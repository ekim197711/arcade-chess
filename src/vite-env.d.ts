/// <reference types="vite/client" />

declare const __BOSS_PORTRAITS__: Record<string, readonly string[] | undefined>;
declare const __BOARD_SOUND_THEMES__: readonly import("./soundThemes").SoundThemeManifest[];

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
