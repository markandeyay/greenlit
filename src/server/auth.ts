// Session lookup contract. WS7 implements this with Supabase Auth; until then nobody is signed in.
// Server modules call getCurrentUser() to attach plays to a profile (Section 10.8).
import 'server-only';

export interface SessionUser {
  id: string; // profile id (= Supabase auth user id)
  email: string | null;
  isAdmin: boolean; // email listed in ADMIN_EMAILS
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  return null;
}
