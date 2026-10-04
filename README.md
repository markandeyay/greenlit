# Greenlit

Daily movie deduction game. Spec: [`docs/greenlit-system-design.md`](docs/greenlit-system-design.md) (single source of truth; Section 9.1 records contract decisions made during the build).

Live: https://greenlit-gamma.vercel.app (every push to `main` deploys via Vercel's GitHub integration).

## Run locally

```bash
pnpm install
pnpm dev                     # http://localhost:3000
```

No keys are required. Without Supabase env vars the app runs in **keyless mode**: an in-memory repo seeded from the bundled 100-film fixture library (`src/server/db/fixtures/library.json`) with a deterministic daily schedule, plays mirrored in a signed cookie, and pitch links as opaque encrypted tokens (Section 9.1, item 17).

Optional: `cp .env.example .env.local` and fill in keys (below). Real keys switch the app over with no code changes.

## Checks

```bash
pnpm typecheck
pnpm lint
pnpm test        # Vitest unit tests (tests/unit)
pnpm test:e2e    # Playwright e2e incl. the answer leak test (first run: pnpm exec playwright install chromium)
pnpm db:verify   # applies supabase/migrations to a throwaway Docker Postgres and asserts RLS
```

## Connecting real services

| Service | Env vars | What it unlocks |
|---|---|---|
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Durable plays, accounts (magic link, Google, X), leaderboards, global stats, `/admin` |
| TMDB | `TMDB_READ_TOKEN` (or `TMDB_API_KEY`) | Real ~4,000 film library with posters, headshots, trailers (`scripts/ingest/README.md`) |
| Upstash Redis | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Cross-instance rate limits (in-memory fallback otherwise) |
| Admin | `ADMIN_EMAILS` | Comma-separated emails allowed into `/admin` |
| Signing | `SESSION_SECRET` | Signs the keyless play cookie and encrypts keyless pitch slugs (already set on Vercel) |

Supabase project setup: run every file in `supabase/migrations/` in order (SQL editor or `supabase db push`). The app loads the bundled library and writes the default schedule into an empty database on first request. For auth, add `<site>/auth/callback` to the Supabase redirect allow-list and enable the Google and X providers.

## Layout

See Section 11 of the spec. Shared contracts: `src/lib/types.ts`, `src/config/*`, `src/server/db/repo.ts`, `src/styles/tokens.css`, `supabase/migrations/*`. Design system notes: `src/styles/README.md`.
