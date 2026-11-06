import assert from 'node:assert/strict';
import { isLocalHostname, resolveSupabaseEnvironment } from './src/supabaseEnvironment.ts';
const env = {
  VITE_SUPABASE_DEV_URL: 'https://development.supabase.co',
  VITE_SUPABASE_DEV_PUBLISHABLE_KEY: 'development-key',
  VITE_SUPABASE_PROD_URL: 'https://production.supabase.co',
  VITE_SUPABASE_PROD_PUBLISHABLE_KEY: 'production-key',
};
for (const host of ['localhost', 'LOCALHOST.', 'arcade.localhost', 'arcade.local', '127.0.0.1', '127.0.0.2', '[::1]', '::1', '0.0.0.0', '192.168.1.42', '10.0.0.2', '172.16.0.2', '172.31.255.254']) {
  assert.equal(isLocalHostname(host), true, host);
  const config = resolveSupabaseEnvironment(host, env);
  assert.equal(config.environment, 'development');
  assert.equal(config.url, env.VITE_SUPABASE_DEV_URL);
  assert.equal(config.key, 'development-key');
  assert.equal(config.error, '');
}
for (const host of ['arcadegambit.com', 'www.arcadegambit.com', 'preview.arcadegambit.com', 'localhost.example.com', '172.32.0.1', '8.8.8.8']) {
  assert.equal(isLocalHostname(host), false, host);
  const config = resolveSupabaseEnvironment(host, env);
  assert.equal(config.environment, 'production');
  assert.equal(config.url, env.VITE_SUPABASE_PROD_URL);
  assert.equal(config.key, 'production-key');
  assert.equal(config.error, '');
}
const legacy = { VITE_SUPABASE_URL: 'https://legacy.supabase.co', VITE_SUPABASE_ANON_KEY: 'legacy-key' };
assert.equal(resolveSupabaseEnvironment('arcadegambit.com', legacy).key, 'legacy-key');
assert.match(resolveSupabaseEnvironment('localhost', legacy).error, /Development sign-in is not configured/);
assert.equal(resolveSupabaseEnvironment('localhost', legacy).url, '');
assert.match(resolveSupabaseEnvironment('localhost', { ...env, VITE_SUPABASE_DEV_PUBLISHABLE_KEY: '' }).error, /not configured/);
assert.match(resolveSupabaseEnvironment('arcadegambit.com', { VITE_SUPABASE_DEV_URL: env.VITE_SUPABASE_DEV_URL, VITE_SUPABASE_DEV_PUBLISHABLE_KEY: 'dev' }).error, /Production sign-in is not configured/);
assert.match(resolveSupabaseEnvironment('localhost', { ...env, VITE_SUPABASE_DEV_URL: 'https://production.supabase.co/' }).error, /separate Supabase projects/);
assert.match(resolveSupabaseEnvironment('localhost', { ...env, VITE_SUPABASE_DEV_URL: 'invalid-url' }).error, /invalid/);
console.log('PASS hostname routing, localhost/IPv4/IPv6/LAN, public domains, production-only legacy compatibility, missing settings, shared-project rejection, invalid URLs');
