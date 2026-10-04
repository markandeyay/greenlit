// Browser Supabase client factory (WS7). Returns null in keyless mode so callers can show the
// "accounts open soon" state instead of throwing.
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabasePublicConfig } from './config';

let cached: SupabaseClient | null | undefined;

export function getBrowserSupabase(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  const cfg = supabasePublicConfig();
  if (!cfg || typeof window === 'undefined') return null;
  try {
    cached = createBrowserClient(cfg.url, cfg.anonKey);
  } catch {
    cached = null;
  }
  return cached;
}

/** The URL Supabase redirects back to after a magic link or OAuth round trip. */
export function authCallbackUrl(next: string = '/settings'): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
}
