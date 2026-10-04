// Admin gate (Section 3 "/admin auth gated", Section 9 "/api/admin/* admin role only").
//
// Allowed when:
//   1. the signed-in user is an admin (getCurrentUser()?.isAdmin, i.e. email in ADMIN_EMAILS), OR
//   2. process.env.NODE_ENV === 'development' (LOCAL DEV CONVENIENCE ONLY: `pnpm dev` opens the
//      admin to anyone on your machine so you can schedule against the fixture library without
//      setting up auth. `next build` / `next start` and Vercel always run with NODE_ENV
//      'production', where only real admins get in).
// Everyone else gets a polite sign-in screen (no data) and the APIs answer 403.
import 'server-only';
import { getCurrentUser, type SessionUser } from '@/server/auth';
import { ApiFailure, handle } from '@/server/http';

export interface AdminAccess {
  allowed: boolean;
  user: SessionUser | null;
  /** True when access comes only from the development bypass. */
  devBypass: boolean;
}

/** Pure decision, exported for tests. */
export function decideAdminAccess(user: SessionUser | null, nodeEnv: string | undefined): AdminAccess {
  if (user?.isAdmin) return { allowed: true, user, devBypass: false };
  if (nodeEnv === 'development') return { allowed: true, user, devBypass: true };
  return { allowed: false, user, devBypass: false };
}

export async function getAdminAccess(): Promise<AdminAccess> {
  let user: SessionUser | null = null;
  try {
    user = await getCurrentUser();
  } catch {
    user = null;
  }
  return decideAdminAccess(user, process.env.NODE_ENV);
}

/** Wrap an admin API handler: 403 unless allowed, ApiFailure -> ApiError. */
export async function adminRoute(fn: (access: AdminAccess) => Promise<Response>): Promise<Response> {
  return handle(async () => {
    const access = await getAdminAccess();
    if (!access.allowed) throw new ApiFailure('forbidden', 'Admins only. Sign in with an admin account.');
    return fn(access);
  });
}
