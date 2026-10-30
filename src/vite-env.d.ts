/// <reference types="vite/client" />

declare const __BOSS_PORTRAITS__: Record<string, readonly string[] | undefined>;
declare const __APP_BUILD__: import('./buildInfo').AppBuild;
declare const __BOARD_SOUND_THEMES__: readonly import("./soundThemes").SoundThemeManifest[];

interface ImportMetaEnv {
  readonly VITE_GA_MEASUREMENT_ID?: string;
  readonly VITE_GA_DEV_MEASUREMENT_ID?: string;
  readonly VITE_SUPABASE_DEV_URL: string;
  readonly VITE_SUPABASE_DEV_PUBLISHABLE_KEY: string;
  readonly VITE_SUPABASE_PROD_URL: string;
  readonly VITE_SUPABASE_PROD_PUBLISHABLE_KEY: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
