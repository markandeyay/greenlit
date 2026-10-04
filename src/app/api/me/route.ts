// GET /api/me (WS7): the signed-in user, their profile, and stats synced from server plays.
// In keyless mode (or signed out) returns { authConfigured, user: null, ... }. Never cached.
import { getCurrentUser } from '@/server/auth';
import { handle, json } from '@/server/http';
import { getMe } from '@/server/profile';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  return handle(async () => json(await getMe(await getCurrentUser())));
}
