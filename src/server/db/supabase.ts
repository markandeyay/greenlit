// Supabase-backed Repo using the service role key. SERVER ONLY. Implemented by WS0.
import 'server-only';
import type { Repo } from './repo';

export function createSupabaseRepo(): Repo {
  throw new Error('Supabase repo not implemented yet');
}
