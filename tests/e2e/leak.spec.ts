// LEAK TEST (Section 10, Phase 1 exit criterion in Section 13). Plays a full daily round as an
// anonymous player against the production build and asserts the answer's title, tagline and TMDB
// id never appear in any response body, URL or JS-readable cookie before the reveal. See
// scripts/qa/leak-runner.ts for what is recorded and scripts/qa/leak-scan.ts for the match rules.
// Standalone: `pnpm exec tsx scripts/qa/leak-test.ts [baseURL]`.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { RULES } from '../../src/config/rules';
import { library, todayAnswer, wrongFilms } from './helpers/answer';
import { runLeakTest } from '../../scripts/qa/leak-runner';
import { buildNeedles, findIdInText, findLibraryInChunk, findTitle, findTagline } from '../../scripts/qa/leak-scan';
import { test, expect } from './fixtures';

test.describe.configure({ mode: 'serial' });

test('the daily answer never reaches the client before the reveal', async ({ browser, baseURL }, testInfo) => {
  test.setTimeout(240_000);
  const answer = todayAnswer();
  const report = await runLeakTest({
    browser,
    baseURL: baseURL!,
    answer,
    wrong: wrongFilms(answer, RULES.maxGuesses - 1),
    library,
  });

  const summary = {
    answer: report.answer,
    counts: report.counts,
    visited: report.visited,
    findingsBeforeReveal: report.findings,
    revealFindings: report.revealFindings.length,
    glPlaysHttpOnly: report.cookieChecks.glPlaysHttpOnly,
    unreadable: report.responses.filter((r) => r.unreadable).map((r) => `${r.phase} ${r.status} ${r.url}`),
  };
  await testInfo.attach('leak-report.json', { body: JSON.stringify(summary, null, 2), contentType: 'application/json' });
  console.log(`[leak] ${report.counts.before} responses before reveal (js ${report.counts.js}, css ${report.counts.css}, html ${report.counts.html}, rsc ${report.counts.rsc}, json ${report.counts.json}, images ${report.counts.images}, unreadable ${report.counts.unreadable}); findings: ${report.findings.length}`);

  // Coverage sanity: we really recorded documents, chunks and API JSON.
  expect(report.counts.js).toBeGreaterThan(3);
  expect(report.counts.html).toBeGreaterThan(3);
  expect(report.counts.json).toBeGreaterThan(RULES.maxGuesses);
  expect(report.counts.rsc).toBeGreaterThan(0);

  // No blind spots: every API URL and script requested before the reveal was read at least once.
  // (A fetch the page abandoned when it navigated away has no body; the same URL read elsewhere
  // covers it.)
  const readUrls = new Set(report.responses.filter((r) => r.phase === 'before' && !r.unreadable).map((r) => r.url));
  const blind = report.responses.filter(
    (r) => r.phase === 'before' && r.unreadable && (r.url.includes('/api/') || r.resourceType === 'script') && !readUrls.has(r.url),
  );
  expect(blind.map((r) => r.url)).toEqual([]);

  // THE assertion.
  expect(report.findings, JSON.stringify(report.findings, null, 2)).toEqual([]);

  // Positive control: once the player finishes, the reveal carries the answer, so the scanner works.
  expect(report.revealFindings.some((f) => f.kind === 'title')).toBe(true);
  expect(report.revealFindings.some((f) => f.kind === 'id')).toBe(true);

  // Cookies: plays are mirrored in an httpOnly cookie that scripts cannot read.
  expect(report.cookieChecks.glPlaysHttpOnly).toBe(true);
  expect(report.cookieChecks.documentCookie).not.toContain('gl_plays');
});

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

test('no client chunk on disk contains the answer or the film library', async () => {
  const dir = join(process.cwd(), '.next', 'static');
  test.skip(!existsSync(dir) || process.env.E2E_DEV === '1', 'needs a production build in .next/static');
  const answer = todayAnswer();
  const needles = buildNeedles(answer);
  const problems: string[] = [];
  for (const file of walk(dir).filter((f) => /\.(js|css|json)$/.test(f))) {
    const body = readFileSync(file, 'utf8');
    const lib = findLibraryInChunk(body, library);
    if (lib) problems.push(`${file}: library data (${lib})`);
    const t = findTitle(body, needles);
    if (t) problems.push(`${file}: answer title (${t})`);
    const tg = findTagline(body, needles);
    if (tg) problems.push(`${file}: answer tagline (${tg})`);
    const id = findIdInText(body, answer.id);
    if (id) problems.push(`${file}: answer id (${id})`);
  }
  expect(problems, problems.join('\n')).toEqual([]);
});

test('answer-bearing endpoints refuse anonymous, cross-kind and future access', async ({ request }) => {
  const answer = todayAnswer();
  const today = (await (await request.get('/api/today')).json()) as { number: number };
  const n = today.number;
  const refuse = async (res: Awaited<ReturnType<typeof request.get>>) => {
    expect(res.status(), res.url()).toBeGreaterThanOrEqual(400);
    const text = await res.text();
    expect(text.toLowerCase()).not.toContain(answer.title.toLowerCase());
    expect(text).not.toMatch(new RegExp(`"filmId"\s*:\s*${answer.id}\b`));
  };
  // Admin data (the whole schedule) is admin only.
  for (const p of ['/api/admin/schedule', '/api/admin/films', `/api/admin/films/${answer.id}`, '/api/admin/studios']) {
    await refuse(await request.get(p));
  }
  // Today and future reels cannot be played, given up or hinted through the vault kind, and the
  // daily kind only accepts today.
  for (const data of [
    { kind: 'vault', ref: String(n) },
    { kind: 'vault', ref: String(n + 1) },
    { kind: 'daily', ref: String(n + 1) },
    { kind: 'pitch', ref: String(n) },
  ]) {
    await refuse(await request.post('/api/giveup', { data }));
    await refuse(await request.get(`/api/play?kind=${data.kind}&ref=${data.ref}`));
    await refuse(await request.get(`/api/hint/options?kind=${data.kind}&ref=${data.ref}`));
  }
  // Hint options are type ids only, never content.
  const opts = await request.get(`/api/hint/options?kind=daily&ref=${n}`);
  expect(opts.status()).toBe(200);
  const body = (await opts.json()) as { slot1: string[]; slot2: string[] };
  for (const t of [...body.slot1, ...body.slot2]) expect(t).toMatch(/^[a-z_]+$/);
});
