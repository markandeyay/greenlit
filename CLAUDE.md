@AGENTS.md

# Greenlit project rules

- Spec: `docs/greenlit-system-design.md` wins over everything. Contracts: Sections 8, 9, 9.1.
- Shared, orchestrator-owned: `src/lib/types.ts`, `src/config/*`, `supabase/migrations/*`. Do not edit from a workstream; report needed changes.
- The puzzle answer never reaches the client (responses, HTML, JS, URLs, OG images) before the player finishes (Section 10).
- No em dashes in user-facing copy. Product name only via `APP_NAME`. Thresholds only via `RULES` / `src/config/game.ts`.
- UI: works at 375px, keyboard accessible, color never the only signal, respects prefers-reduced-motion.
- Before done: `pnpm typecheck && pnpm lint && pnpm test`.
