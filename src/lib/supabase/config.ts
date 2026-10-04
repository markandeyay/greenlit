// Supabase Auth feature detection (WS7). Client-safe.
//
// The site runs in keyless mode until the owner connects Supabase. Every account feature checks
// isAuthConfigured() first and degrades gracefully (no sign-in UI, local stats only).
// NEXT_PUBLIC_* values are inlined at build time, so they must be referenced literally here.

export interface SupabasePublicConfig {
  url: string;
  anonKey: string;
}

/** The public Supabase URL and anon key, or null when either is missing. */
export function supabasePublicConfig(): SupabasePublicConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

/** True when Supabase Auth can be used (public URL and anon key are set). */
export function isAuthConfigured(): boolean {
  return supabasePublicConfig() !== null;
}

/** Supabase stores the session in cookies named `sb-<project>-auth-token` (possibly chunked). */
export function isSupabaseAuthCookie(name: string): boolean {
  return name.startsWith('sb-') && name.includes('-auth-token');
}

/** OAuth providers offered on the sign-in panel (Section 11: Google, X, email magic link). */
export const OAUTH_PROVIDERS = [
  { id: 'google', label: 'Google' },
  { id: 'x', label: 'X' },
] as const;

export type OAuthProviderId = (typeof OAUTH_PROVIDERS)[number]['id'];
