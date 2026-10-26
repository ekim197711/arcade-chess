export type SupabaseEnvironmentVariables = {
  VITE_SUPABASE_DEV_URL?: string;
  VITE_SUPABASE_DEV_PUBLISHABLE_KEY?: string;
  VITE_SUPABASE_PROD_URL?: string;
  VITE_SUPABASE_PROD_PUBLISHABLE_KEY?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  VITE_SUPABASE_ANON_KEY?: string;
};

export function isLocalHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") ||
    host === "::1" || host === "[::1]" || host === "0.0.0.0") return true;
  const parts = host.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 127 || parts[0] === 10 ||
    (parts[0] === 192 && parts[1] === 168) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31);
}

export function resolveSupabaseEnvironment(hostname: string, env: SupabaseEnvironmentVariables) {
  const environment = isLocalHostname(hostname) ? "development" : "production";
  // Legacy single-project variables are production-only. Localhost never falls back to them.
  const productionUrl = (env.VITE_SUPABASE_PROD_URL || env.VITE_SUPABASE_URL || "").trim();
  const productionKey = (env.VITE_SUPABASE_PROD_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || "").trim();
  const url = environment === "development" ? (env.VITE_SUPABASE_DEV_URL || "").trim() : productionUrl;
  const key = environment === "development" ? (env.VITE_SUPABASE_DEV_PUBLISHABLE_KEY || "").trim() : productionKey;
  let error = "";
  if (!url || !key) error = `${environment === "development" ? "Development" : "Production"} sign-in is not configured. Guest progress is saved on this device.`;
  else {
    try {
      const selectedUrl = new URL(url);
      if (!["http:", "https:"].includes(selectedUrl.protocol)) throw new Error("Invalid URL");
      if (environment === "development" && productionUrl && selectedUrl.origin === new URL(productionUrl).origin) {
        error = "Development and production must use separate Supabase projects. Guest progress is saved on this device.";
      }
    } catch { error = "The Supabase project address is invalid. Guest progress is saved on this device."; }
  }
  return { environment, url, key, error };
}
