// Visual QA for Dailies Reel, Opening Weekend and Release Order. Usage:
//   node scripts/qa/modes-a-shots.mjs <outDir> [baseUrl=http://localhost:3200]
// Plays each mode to its result screen in a fresh context (fresh anon player) at 390x844 and
// 1440x900, and captures the entry screen, mid-game and the result. Reduced motion on.
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';

const [outDir = 'shots', base = 'http://localhost:3200'] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const lib = JSON.parse(readFileSync(new URL('../../src/server/db/fixtures/library.json', import.meta.url), 'utf8'));
const gross = new Map(lib.films.map((f) => [f.id, f.boxOfficeUsd ?? 0]));

const browser = await chromium.launch();
const sizes = [
  ['m390', { width: 390, height: 844 }],
  ['d1440', { width: 1440, height: 900 }],
];

async function ctxFor(viewport) {
  const ctx = await browser.newContext({ viewport, reducedMotion: 'reduce', hasTouch: viewport.width < 600 });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('gl_leader', new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date()));
    } catch {}
  });
  return ctx;
}

async function overflow(page, label) {
  const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (o > 0) console.log(`${label}: horizontal overflow ${o}px`);
}

async function shot(page, name, full = false) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${outDir}/${name}.png`, fullPage: full });
  await overflow(page, name);
}

async function higher(page) {
  const l = Number(await page.getByTestId('ow-card-left').getAttribute('data-film-id'));
  const r = Number(await page.getByTestId('ow-card-right').getAttribute('data-film-id'));
  return gross.get(l) > gross.get(r) ? 'left' : 'right';
}

for (const [label, viewport] of sizes) {
  // Opening Weekend: lobby, daily run mid-game, reveal, result.
  {
    const ctx = await ctxFor(viewport);
    const page = await ctx.newPage();
    await page.goto(`${base}/modes/opening-weekend`, { waitUntil: 'networkidle' });
    await shot(page, `${label}-ow-lobby`);
    await page.getByRole('button', { name: /Today's run/ }).click();
    await page.getByTestId('ow-run').waitFor();
    for (let i = 0; i < 3; i++) {
      await page.waitForFunction(() => !document.querySelector('[data-testid="ow-card-left"]')?.hasAttribute('disabled'));
      if (i === 1) await shot(page, `${label}-ow-mid`);
      const side = await higher(page);
      await page.getByTestId(`ow-card-${side}`).click();
      if (i === 0) {
        await page.getByTestId('ow-verdict').waitFor();
        await shot(page, `${label}-ow-correct`);
      }
    }
    await page.waitForFunction(() => !document.querySelector('[data-testid="ow-card-left"]')?.hasAttribute('disabled'));
    const wrong = (await higher(page)) === 'left' ? 'right' : 'left';
    await page.getByTestId(`ow-card-${wrong}`).click();
    await page.getByTestId('ow-over').waitFor();
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot(page, `${label}-ow-wrong`);
    await page.getByTestId('ow-over').scrollIntoViewIfNeeded();
    await shot(page, `${label}-ow-result`, true);
    await ctx.close();
  }

  // Release Order: board, after one take (chips), result after three takes.
  {
    const ctx = await ctxFor(viewport);
    const page = await ctx.newPage();
    await page.goto(`${base}/modes/release-order`, { waitUntil: 'networkidle' });
    await page.getByTestId('ro-item').first().waitFor();
    await shot(page, `${label}-ro-board`);
    for (let t = 0; t < 3; t++) {
      await page.getByRole('button', { name: 'Lock this order' }).click();
      await page.waitForFunction((n) => document.querySelectorAll('[data-testid="ro-attempt"]').length >= n, t + 1);
      if (t === 0) await shot(page, `${label}-ro-take1`);
      if (t < 2) {
        // Shuffle a little between takes.
        const btn = page.getByRole('button', { name: /^Move .* down$/ }).first();
        if (await btn.isEnabled()) await btn.click();
      }
    }
    await page.getByTestId('ro-result').waitFor();
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot(page, `${label}-ro-result`);
    await shot(page, `${label}-ro-result-full`, true);
    await ctx.close();
  }

  // Dailies Reel: picker, board after one take, result after giving up.
  {
    const ctx = await ctxFor(viewport);
    const page = await ctx.newPage();
    await page.goto(`${base}/modes/unlimited`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Roll the reel' }).waitFor();
    await shot(page, `${label}-ur-pick`);
    await page.getByRole('button', { name: 'Roll the reel' }).click();
    const input = page.getByRole('combobox', { name: /Name a film/i });
    await input.waitFor({ timeout: 20000 });
    await shot(page, `${label}-ur-board`);
    const film = lib.films.find((f) => f.isPlayable && f.title === 'Whiplash') ?? lib.films.find((f) => f.isPlayable);
    await input.click();
    await input.fill(film.title);
    await page.getByRole('option').filter({ hasText: film.title }).first().click();
    await page.locator('article[data-take]').first().waitFor();
    await shot(page, `${label}-ur-take1`);
    const give = page.getByRole('button', { name: /Walk away/i });
    if (await give.count()) {
      await give.first().click();
      await page.getByRole('alertdialog').getByRole('button', { name: /Walk away/i }).click();
    }
    await page.waitForTimeout(1200);
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot(page, `${label}-ur-result`, true);
    await ctx.close();
  }
}
await browser.close();
console.log('done', outDir);
