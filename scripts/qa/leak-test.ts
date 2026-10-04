// Standalone leak test (WS10). Plays today's daily round in headless Chromium against a running
// server and exits non-zero if the answer leaks before the reveal.
//
//   pnpm build && pnpm start --port 3200      # in one terminal (production build preferred)
//   pnpm exec tsx scripts/qa/leak-test.ts http://localhost:3200
//
// The server must run in keyless mode (fixture library) on this machine's clock, because the
// answer is computed locally from the same deterministic schedule. The same check runs inside
// `pnpm test:e2e` as tests/e2e/leak.spec.ts.
import { chromium } from '@playwright/test';
import { RULES } from '../../src/config/rules';
import { library, todayAnswer, wrongFilms } from './answer';
import { runLeakTest } from './leak-runner';

async function main() {
  const baseURL = process.argv[2] ?? process.env.LEAK_BASE_URL ?? 'http://localhost:3100';
  const answer = todayAnswer();
  console.log(`[leak] target ${baseURL}`);
  const browser = await chromium.launch();
  try {
    const report = await runLeakTest({
      browser,
      baseURL,
      answer,
      wrong: wrongFilms(answer, RULES.maxGuesses - 1),
      library,
      log: (m) => console.log(`[leak] ${m}`),
    });
    console.log(`[leak] responses: ${JSON.stringify(report.counts)}`);
    console.log(`[leak] visited: ${report.visited.join(', ')}`);
    console.log(`[leak] gl_plays httpOnly: ${report.cookieChecks.glPlaysHttpOnly}`);
    const control = report.revealFindings.some((f) => f.kind === 'title') && report.revealFindings.some((f) => f.kind === 'id');
    console.log(`[leak] positive control (answer present after reveal): ${control ? 'ok' : 'MISSING'}`);
    if (report.findings.length) {
      console.error('[leak] FAIL: the answer leaked before the reveal:');
      for (const f of report.findings) console.error(`  - [${f.kind}] ${f.source}: ${f.detail}`);
    }
    const ok = report.findings.length === 0 && control && report.cookieChecks.glPlaysHttpOnly === true;
    console.log(ok ? '[leak] PASS' : '[leak] FAIL');
    process.exitCode = ok ? 0 : 1;
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
