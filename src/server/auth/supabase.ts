// Server Supabase client bound to the request cookies (WS7). SERVER ONLY.
// Next.js 16: cookies() is async. In Server Components the cookie store is read only, so set
// calls are swallowed there; the proxy (src/proxy.ts) refreshes the session cookies instead.
import 'server-only';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { supabasePublicConfig } from '@/lib/supabase/config';

/** A server client for the current request, or null in keyless mode. */
export async function createServerSupabase(): Promise<SupabaseClient | null> {
  const cfg = supabasePublicConfig();
  if (!cfg) return null;
  const store = await cookies();
  return createServerClient(cfg.url, cfg.anonKey, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(list) {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Called from a Server Component: cookies are read only. The proxy refreshes them.
        }
      },
    },
  });
}
