// Session lookup contract (Section 9.1 item 15), implemented by WS7 with Supabase Auth.
// Server modules call getCurrentUser() to attach plays to a profile (Section 10.8).
//
// Guarantees: returns null immediately when Supabase is not configured (keyless mode) or when the
// request carries no Supabase auth cookie, and never throws. The JWT is verified with
// auth.getClaims() (local JWKS verification when the project uses asymmetric keys).
import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { isAuthConfigured, isSupabaseAuthCookie } from '@/lib/supabase/config';
import { isAdminEmail } from '@/server/auth/admin';
import { createServerSupabase } from '@/server/auth/supabase';

export interface SessionUser {
  id: string; // profile id (= Supabase auth user id)
  email: string | null;
  isAdmin: boolean; // email listed in ADMIN_EMAILS
}

async function lookup(): Promise<SessionUser | null> {
  if (!isAuthConfigured()) return null;
  try {
    const store = await cookies();
    if (!store.getAll().some((c) => isSupabaseAuthCookie(c.name))) return null;
    const supabase = await createServerSupabase();
    if (!supabase) return null;
    const { data, error } = await supabase.auth.getClaims();
    const claims = data?.claims;
    if (error || !claims || typeof claims.sub !== 'string' || !claims.sub) return null;
    if (claims.role && claims.role !== 'authenticated') return null;
    const email = typeof claims.email === 'string' && claims.email ? claims.email : null;
    return { id: claims.sub, email, isAdmin: isAdminEmail(email) };
  } catch {
    // Outside a request scope, network failure, malformed cookie: treat as signed out.
    return null;
  }
}

/** The signed-in user for the current request, or null. Memoized per request. */
export const getCurrentUser: () => Promise<SessionUser | null> = cache(lookup);
