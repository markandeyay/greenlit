// Scheduling (WS8). Entry points (run each with `pnpm exec tsx <file>`):
//   scripts/schedule/seed-puzzles.ts     ensure puzzles exist from today through today + N days
//   scripts/schedule/generate-hints.ts   preview drafted Script Notes for film ids
// The pure logic lives in src/server/admin (hints-draft.ts, seed-plan.ts, rules.ts).
export { generateHints, loadLocalLibrary } from './generate-hints';
export { planSeed } from '../../src/server/admin/seed-plan';
export type { SeedPlan, SeedPlanInput } from '../../src/server/admin/seed-plan';
