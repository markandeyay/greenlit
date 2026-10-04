// Visual review for Casting Call and Logline: plays each mode to its result screen and captures
// 390x844 and 1440x900 screenshots at the start, mid-game and at the result. Run with tsx (it
// imports the cast graph from TypeScript to compute today's optimal chain like the e2e spec):
//   pnpm exec tsx scripts/qa/modes-b-shots.mjs <outDir> [baseUrl=http://localhost:3200]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import fixture from '../../src/server/db/fixtures/library.json' with { type: 'json' };
import { buildCastGraph, pickDailyPair } from '../../src/server/modes/casting-call/graph.ts';
import { dateInResetZone } from '../../src/lib/dates.ts';

const [outDir = 'shots', base = 'http://localhost:3200'] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });

const graph = buildCastGraph(fixture.films, fixture.people);
const pair = pickDailyPair(graph, dateInResetZone());
const playable = fixture.films.filter((f) => f.isPlayable);
const WRONG = ['Fargo', 'Jaws', 'Rocky', 'Titanic', 'Gladiator', 'Whiplash', 'Arrival', 'Parasite']
  .map((t) => playable.find((f) => f.title === t))
  .filter(Boolean);

async function overflow(page, tag) {
  const wide = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const out = [];
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.right > vw + 1) out.push(`${el.tagName}.${String(el.className).slice(0, 50)} right=${Math.round(r.right)}`);
    }
    return { sw: document.documentElement.scrollWidth, vw, out: out.slice(0, 6) };
  });
  if (wide.sw > wide.vw + 1) console.log(`OVERFLOW ${tag}: scrollWidth ${wide.sw} > ${wide.vw}`, wide.out);
}

/** Wait (best effort) for the share card PNG to finish rendering. */
async function cardReady(page) {
  await page
    .waitForFunction(() => [...document.querySelectorAll('[data-share-text] img')].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 15000 })
    .catch(() => console.log('share card image did not load in time'));
}

async function snap(page, name, full = false) {
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${outDir}/${name}.png`, fullPage: full });
  await overflow(page, name);
}

async function newPage(browser, viewport) {
  const ctx = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('gl_leader', new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date()));
    } catch {}
  });
  return { ctx, page: await ctx.newPage() };
}

async function castingWin(browser, label, viewport) {
  const { ctx, page } = await newPage(browser, viewport);
  await page.goto(`${base}/modes/casting-call`, { waitUntil: 'networkidle' });
  await snap(page, `${label}-cc-1-start`);
  for (const [i, l] of pair.optimal.entries()) {
    await page.getByTestId('cc-film-picker').locator(`[data-option-id="${l.filmId}"]`).click();
    if (i === 0) await snap(page, `${label}-cc-2-castmate`);
    await page.getByTestId('cc-actor-picker').locator(`[data-option-id="${l.personId}"]`).click();
    if (i === 0 && pair.optimal.length > 1) {
      await page.getByTestId('cc-film-picker').waitFor();
      await snap(page, `${label}-cc-3-mid`, true);
    }
  }
  await page.getByTestId('cc-result').waitFor();
  await cardReady(page);
  await snap(page, `${label}-cc-4-won`);
  await snap(page, `${label}-cc-4-won-full`, true);
  await ctx.close();
}

async function castingLoss(browser, label, viewport) {
  const { ctx, page } = await newPage(browser, viewport);
  await page.goto(`${base}/modes/casting-call`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Walk away' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Walk away' }).click();
  await page.getByTestId('cc-result').waitFor();
  await cardReady(page);
  await snap(page, `${label}-cc-5-lost-full`, true);
  await page.goto(`${base}/modes/casting-call`, { waitUntil: 'networkidle' });
  await ctx.close();
}

async function howTo(browser, label, viewport, path, tag) {
  const { ctx, page } = await newPage(browser, viewport);
  await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'How to play' }).click();
  await snap(page, `${label}-${tag}-howto`);
  await ctx.close();
}

async function logline(browser, label, viewport) {
  const { ctx, page } = await newPage(browser, viewport);
  await page.goto(`${base}/modes/logline`, { waitUntil: 'networkidle' });
  await snap(page, `${label}-ll-1-start`);
  for (const [i, film] of WRONG.entries()) {
    if (await page.getByTestId('logline-reveal-title').isVisible()) break;
    const field = page.getByRole('combobox', { name: /Name the film/i });
    await field.click();
    await field.fill(film.title);
    const option = page.getByRole('option').filter({ hasText: film.title }).filter({ hasText: String(film.releaseYear) }).first();
    await option.waitFor();
    const res = page.waitForResponse((r) => r.url().includes('/api/modes/logline/guess'));
    await option.click();
    await res;
    await page.waitForTimeout(200);
    if (i === 1) await snap(page, `${label}-ll-2-mid`);
  }
  await page.getByTestId('logline-reveal-title').waitFor();
  await cardReady(page);
  await snap(page, `${label}-ll-3-result`);
  await snap(page, `${label}-ll-3-result-full`, true);
  await ctx.close();
}

const browser = await chromium.launch();
for (const [label, viewport] of [
  ['m390', { width: 390, height: 844 }],
  ['d1440', { width: 1440, height: 900 }],
]) {
  await castingWin(browser, label, viewport);
  await castingLoss(browser, label, viewport);
  await logline(browser, label, viewport);
  if (label === 'm390') {
    await howTo(browser, label, viewport, '/modes/casting-call', 'cc');
    await howTo(browser, label, viewport, '/modes/logline', 'll');
  }
}
await browser.close();
console.log('done', outDir, 'optimal films:', pair.optimal.length);
