// Seed the daily schedule (Sections 13 and 14, WS8).
//
//   pnpm exec tsx scripts/schedule/seed-puzzles.ts [--days N] [--from YYYY-MM-DD] [--force] [--dry-run]
//
// Ensures a puzzle exists for every date from today (or LAUNCH_DATE if later) through
// today + N days. N defaults to SCHEDULING.aheadDays and is never below MIN_SEED_DAYS (the
// Phase 1 exit criterion, "14 days of puzzles scheduled"). Films are picked by popularity
// (high recognition first), skipping any used within SCHEDULING.repeatCooldownDays and any
// missing required fields; hints come from the WS8 generator and pass the admin validation.
//
// Idempotent: existing puzzles are never overwritten unless --force, and even --force never
// touches past or live (today's) puzzles.
//
// Storage: with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (read from .env.local),
// puzzles are written through the Supabase Repo. The script re-runs itself with Node's
// `--conditions=react-server` so the server-only Repo modules load outside Next.js. Without
// those keys it prints a dry-run plan against the local library (keyless deployments use the
// built-in deterministic schedule instead).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { FIXTURE_LIBRARY_PATH, TMDB_LIBRARY_PATH, isMain, loadEnvFiles, readJson } from '../ingest/io';

/** Phase 1 exit criterion (Section 13): at least 14 days of puzzles scheduled. */
export const MIN_SEED_DAYS = 14;
const CONDITION_FLAG = '--conditions=react-server';
const CERT_BATCH = 25;

export interface SeedArgs {
  days: number | null;
  from: string | null;
  force: boolean;
  dryRun: boolean;
}

export function parseSeedArgs(argv: string[]): SeedArgs {
  const args: SeedArgs = { days: null, from: null, force: false, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--force') args.force = true;
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--days') args.days = Number(argv[++i]);
    else if (a.startsWith('--days=')) args.days = Number(a.slice(7));
    else if (a === '--from') args.from = argv[++i] ?? null;
    else if (a.startsWith('--from=')) args.from = a.slice(7);
  }
  if (args.days !== null && (!Number.isInteger(args.days) || args.days < 0)) throw new Error('--days must be a whole number');
  if (args.from !== null && !/^\d{4}-\d{2}-\d{2}$/.test(args.from)) throw new Error('--from must be YYYY-MM-DD');
  return args;
}

/** Clamp the horizon to [MIN_SEED_DAYS, aheadDays]. */
export function seedHorizon(days: number | null, aheadDays: number): number {
  return Math.min(aheadDays, Math.max(MIN_SEED_DAYS, days ?? aheadDays));
}

async function main(argv: string[]): Promise<void> {
  loadEnvFiles();
  const supabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (supabase && !process.execArgv.includes(CONDITION_FLAG) && !process.env.GL_SEED_CHILD) {
    const r = spawnSync(process.execPath, [...process.execArgv, CONDITION_FLAG, ...process.argv.slice(1)], {
      stdio: 'inherit',
      env: { ...process.env, GL_SEED_CHILD: '1' },
    });
    process.exitCode = r.status ?? 1;
    return;
  }

  const args = parseSeedArgs(argv);
  // Config reads env at import time, so import after loadEnvFiles().
  const { LAUNCH_DATE, SCHEDULING } = await import('../../src/config/game');
  const { addDays, dateInResetZone } = await import('../../src/lib/dates');
  const { planSeed } = await import('../../src/server/admin/seed-plan');
  const { generateHints } = await import('../../src/server/admin/hints-draft');
  type Lib = import('../../src/server/db/repo').LibrarySnapshot;
  type Film = import('../../src/lib/types').Film;
  type Cert = import('../../src/lib/types').FilmCertification;
  type Puzzle = import('../../src/lib/types').Puzzle;

  const today = dateInResetZone();
  const horizon = seedHorizon(args.days, SCHEDULING.aheadDays);
  const startCandidate = args.from ?? today;
  const from = startCandidate < LAUNCH_DATE ? LAUNCH_DATE : startCandidate < today ? today : startCandidate;
  const through = addDays(today, horizon);
  const windowFrom = addDays(from, -SCHEDULING.repeatCooldownDays);
  const windowTo = addDays(through, SCHEDULING.repeatCooldownDays);

  let films: Film[];
  let certs = new Map<number, Cert[]>();
  let existing: Puzzle[];
  let lib: Lib;
  let write: ((p: Puzzle) => Promise<void>) | null = null;
  let mode: string;

  if (supabase) {
    const { createSupabaseRepo } = await import('../../src/server/db/supabase');
    const repo = createSupabaseRepo();
    mode = 'supabase';
    const all = await repo.listFilms();
    // High recognition first; only the top of the list is ever needed.
    films = all.filter((f) => f.isAnswerEligible).sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
    const needed = films.slice(0, Math.max(400, horizon * 6));
    for (let i = 0; i < needed.length; i += CERT_BATCH) {
      const batch = needed.slice(i, i + CERT_BATCH);
      const rows = await Promise.all(batch.map((f) => repo.getCertifications(f.id)));
      batch.forEach((f, j) => certs.set(f.id, rows[j]!));
    }
    films = needed;
    const castIds = [...new Set(needed.flatMap((f) => [f.leadPersonId, ...f.supportingIds].filter((x): x is number => x !== null)))];
    const people = await repo.getPeople(castIds);
    const awards: Lib['awards'] = [];
    for (let i = 0; i < needed.length; i += CERT_BATCH) {
      const rows = await Promise.all(needed.slice(i, i + CERT_BATCH).map((f) => repo.getAwards(f.id)));
      awards.push(...rows.flat());
    }
    lib = { v: 1, generatedAt: new Date().toISOString(), source: 'tmdb', films: all, people, studios: [], studioAliases: [], genres: [], certifications: [], awards };
    existing = await repo.listPuzzles({ fromDate: windowFrom, toDate: windowTo });
    if (!args.dryRun) write = (p) => repo.upsertPuzzle(p);
  } else {
    const path = fs.existsSync(TMDB_LIBRARY_PATH) ? TMDB_LIBRARY_PATH : FIXTURE_LIBRARY_PATH;
    lib = readJson<Lib>(path);
    mode = `dry run (no Supabase keys) against ${path.replace(/\\/g, '/').split('/').slice(-2).join('/')} with an empty schedule`;
    films = lib.films;
    certs = new Map();
    for (const c of lib.certifications) certs.set(c.filmId, [...(certs.get(c.filmId) ?? []), c]);
    existing = [];
  }

  const plan = planSeed({
    today,
    from,
    through,
    films,
    certifications: certs,
    existing,
    generate: (f) => generateHints(f, lib),
    force: args.force,
  });

  const titles = new Map(lib.films.map((f) => [f.id, `${f.title} (${f.releaseYear})`]));
  console.log(`Seed puzzles: ${mode}`);
  console.log(`Window: ${from} to ${through} (${horizon} days ahead of ${today})${args.force ? ', --force' : ''}${args.dryRun ? ', --dry-run' : ''}`);
  for (const p of plan.write) {
    if (write) await write(p);
    const verb = write ? 'wrote' : 'would write';
    console.log(`  ${verb}  ${p.date}  Reel ${String(p.number).padStart(3, '0')}  ${titles.get(p.filmId) ?? `#${p.filmId}`}  [${p.hints.map((h) => h.type).join(', ')}]`);
  }
  for (const u of plan.unfilled) console.log(`  EMPTY  ${u.date}  ${u.reason}`);
  console.log(`Summary: ${plan.write.length} ${write ? 'written' : 'planned'}, ${plan.kept.length} kept, ${plan.unfilled.length} unfilled.`);
  if (plan.unfilled.length) process.exitCode = 2;
}

if (isMain(import.meta.url)) {
  main(process.argv.slice(2)).catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
