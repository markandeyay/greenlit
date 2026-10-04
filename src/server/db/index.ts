// Repo selection (WS0). Supabase when its env vars are present, otherwise the in-memory repo
// seeded from the fixture library with a deterministic schedule.
import 'server-only';
import type { Repo, LibrarySnapshot } from './repo';
import { MemoryRepo, createMemoryState } from './memory';
import { buildDefaultSchedule } from './seed';
import fixtureLibrary from './fixtures/library.json';
import { createSupabaseRepo } from './supabase';

export type { Repo, LibrarySnapshot, PlayFilter } from './repo';

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

const g = globalThis as unknown as { __greenlitRepo?: Repo };

export function createFixtureRepo(lib: LibrarySnapshot = fixtureLibrary as LibrarySnapshot, now?: Date): MemoryRepo {
  const state = createMemoryState(lib);
  for (const p of buildDefaultSchedule(lib, { now })) state.puzzles.set(p.number, p);
  return new MemoryRepo(state);
}

export function getRepo(): Repo {
  if (!g.__greenlitRepo) {
    g.__greenlitRepo = isSupabaseConfigured() ? createSupabaseRepo() : createFixtureRepo();
  }
  return g.__greenlitRepo;
}

/** Tests only: swap the active repo. */
export function setRepoForTesting(repo: Repo | undefined): void {
  g.__greenlitRepo = repo;
}
