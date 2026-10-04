// POST /auth/signout (WS7): end the Supabase session and return to /settings.
// POST only, so a stray link or image cannot sign anyone out.
import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/server/auth/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  try {
    const supabase = await createServerSupabase();
    if (supabase) await supabase.auth.signOut();
  } catch (err) {
    console.error('[auth] sign out failed', err);
  }
  return NextResponse.redirect(new URL('/settings?auth=signedout', request.url), { status: 303 });
}
