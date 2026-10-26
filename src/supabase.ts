import { createClient } from "@supabase/supabase-js";
import { resolveSupabaseEnvironment } from "./supabaseEnvironment";

export const supabaseConfiguration = resolveSupabaseEnvironment(window.location.hostname, {
  VITE_SUPABASE_DEV_URL: import.meta.env.VITE_SUPABASE_DEV_URL,
  VITE_SUPABASE_DEV_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_DEV_PUBLISHABLE_KEY,
  VITE_SUPABASE_PROD_URL: import.meta.env.VITE_SUPABASE_PROD_URL,
  VITE_SUPABASE_PROD_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PROD_PUBLISHABLE_KEY,
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
});
export const supabase = supabaseConfiguration.error ? null : createClient(supabaseConfiguration.url, supabaseConfiguration.key);
