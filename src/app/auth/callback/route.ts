// GET /auth/callback (WS7): Supabase redirects here after OAuth (Google, X) or a magic link.
// Exchanges the code (or verifies the email token hash) for a session cookie, creates the profile
// if missing, merges this device's anonymous plays into it, then redirects to `next`.
import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType, User } from '@supabase/supabase-js';
import { REGION_COOKIE } from '@/config/regions';
import { readAnonId, readCookie } from '@/lib/anon';
import { completeSignIn, safeNext } from '@/server/auth/merge';
import { createServerSupabase } from '@/server/auth/supabase';

export const dynamic = 'force-dynamic';

const EMAIL_TYPES: readonly EmailOtpType[] = ['magiclink', 'email', 'signup', 'invite', 'recovery', 'email_change'];

export async function GET(request: NextRequest): Promise<Response> {
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get('next'));
  const to = (path: string) => NextResponse.redirect(new URL(path, url.origin), { status: 303 });

  if (url.searchParams.get('error')) return to('/settings?auth=error');

  const supabase = await createServerSupabase();
  if (!supabase) return to('/settings?auth=unavailable');

  let user: User | null = null;
  try {
    const code = url.searchParams.get('code');
    const tokenHash = url.searchParams.get('token_hash');
    const type = url.searchParams.get('type') as EmailOtpType | null;
    if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) user = data.user;
    } else if (tokenHash && type && EMAIL_TYPES.includes(type)) {
      const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
      if (!error) user = data.user;
    }
  } catch (err) {
    console.error('[auth] callback exchange failed', err);
  }
  if (!user) return to('/settings?auth=error');

  try {
    await completeSignIn(user.id, readAnonId(request), readCookie(request, REGION_COOKIE));
  } catch (err) {
    // The session is valid even if the merge failed; plays still attach on future takes.
    console.error('[auth] sign-in merge failed', err);
  }
  return to(next);
}
