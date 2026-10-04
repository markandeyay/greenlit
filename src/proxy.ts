// Proxy (Next.js 16's renamed middleware). WS7: refresh the Supabase session cookie before routes
// render, so Server Components see a valid token. Does nothing in keyless mode or when the request
// carries no Supabase auth cookie, so anonymous traffic pays almost nothing.
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isSupabaseAuthCookie, supabasePublicConfig } from '@/lib/supabase/config';

export async function proxy(request: NextRequest) {
  const cfg = supabasePublicConfig();
  if (!cfg) return NextResponse.next();
  if (!request.cookies.getAll().some((c) => isSupabaseAuthCookie(c.name))) return NextResponse.next();

  let response = NextResponse.next({ request });
  try {
    const supabase = createServerClient(cfg.url, cfg.anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(list, headers) {
          for (const { name, value } of list) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of list) response.cookies.set(name, value, options);
          for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
        },
      },
    });
    // Verifies the JWT and refreshes it when it is about to expire.
    await supabase.auth.getClaims();
  } catch {
    // Never block a page on auth trouble.
  }
  return response;
}

export const config = {
  matcher: [
    // Everything except static assets, image optimization, OG images and public files.
    '/((?!_next/static|_next/image|api/og|favicon.ico|icon.svg|search-index.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|json)$).*)',
  ],
};
