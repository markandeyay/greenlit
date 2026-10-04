# Greenlit

Daily movie deduction game. Spec: [`docs/greenlit-system-design.md`](docs/greenlit-system-design.md) (single source of truth).

## Run locally

```bash
pnpm install
cp .env.example .env.local   # optional; runs without keys on the in-memory adapter
pnpm dev                     # http://localhost:3000
```

## Checks

```bash
pnpm typecheck
pnpm lint
pnpm test        # Vitest, tests/unit
pnpm test:e2e    # Playwright, tests/e2e (first run: pnpm exec playwright install chromium)
pnpm db:verify   # applies supabase/migrations to a throwaway Docker Postgres and asserts RLS
```

## Layout

See Section 11 of the spec. Shared contracts: `src/lib/types.ts`, `src/config/*`, `src/styles/tokens.css`, `supabase/migrations/*`.
