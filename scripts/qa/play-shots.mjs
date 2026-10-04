// Visual QA for the classic game screens. Usage:
//   node scripts/qa/play-shots.mjs <outDir> [baseUrl=http://localhost:3200] [paths...=/vault/2 /]
// For each path at 390x844 and 1440x900 it plays real rounds through the UI and captures:
// empty state, the How to play sheet, 3 takes, the Call Sheet expanded, Script Notes unlocked,
// a loss (10 wrong takes), and a win (a fresh player who guesses the revealed answer).
// Every context gets its own anon cookie and pseudo IP, so rounds never collide or hit rate limits.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const [outDir = 'shots', base = 'http://localhost:3200', ...rest] = process.argv.slice(2);
const paths = rest.length ? rest : ['/vault/2', '/'];
mkdirSync(outDir, { recursive: true });

// Well-known titles from the keyless fixture library (wrong guesses unless one is the answer).
const POOL = [
  ['Star Wars', 1977],
  ['Finding Nemo', 2003],
  ['Forrest Gump', 1994],
  ['Memento', 2000],
  ['Gladiator', 2000],
  ['Taxi Driver', 1976],
  ['Back to the Future', 1985],
  ['The Big Lebowski', 1998],
  ['Spirited Away', 2001],
  ['Lost in Translation', 2003],
  ['Raiders of the Lost Ark', 1981],
  ['Kill Bill: Vol. 1', 2003],
  ['Eternal Sunshine of the Spotless Mind', 2004],
];

let ipSeed = Math.floor(Math.random() * 200);
const browser = await chromium.launch();

async function newPage(viewport) {
  ipSeed++;
  const ctx = await browser.newContext({
    viewport,
    reducedMotion: 'reduce',
    extraHTTPHeaders: { 'x-forwarded-for': `10.77.${ipSeed % 250}.${(ipSeed * 7) % 250}` },
  });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('gl_leader', new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date()));
    } catch {}
  });
  return { ctx, page: await ctx.newPage() };
}

const input = (page) => page.getByRole('combobox', { name: /Name a film/i });
const finished = (page) => page.locator('[data-testid="result-card"]');

/** Type, wait for the exact option, make it active with the arrows, press Enter. */
async function guess(page, title, year) {
  if (await finished(page).count()) return false;
  const rows = page.locator('article[data-take]');
  const before = await rows.count();
  const box = input(page);
  await box.click();
  await box.fill(title);
  const opt = page.getByRole('option').filter({ hasText: title }).filter({ hasText: String(year) }).first();
  await opt.waitFor({ state: 'visible', timeout: 15000 });
  if ((await opt.getAttribute('aria-disabled')) === 'true') {
    await box.fill('');
    return true;
  }
  for (let i = 0; i < 12; i++) {
    if ((await opt.getAttribute('aria-selected')) === 'true') break;
    await page.keyboard.press('ArrowDown');
  }
  await page.keyboard.press('Enter');
  await rows.nth(before).waitFor({ state: 'attached', timeout: 15000 });
  await page.waitForTimeout(250);
  return true;
}

async function shot(page, name, full = true) {
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${outDir}/${name}.png`, fullPage: full });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  console.log(`${name}${overflow ? '  OVERFLOW-X' : ''}`);
}

for (const [label, viewport] of [['m390', { width: 390, height: 844 }], ['d1440', { width: 1440, height: 900 }]]) {
  for (const p of paths) {
    const slug = p === '/' ? 'today' : p.replace(/\W+/g, '-').replace(/^-|-$/g, '');
    const tag = `${label}-${slug}`;

    // Round 1: empty, help sheet, 3 takes, Call Sheet, notes unlocked, loss.
    const a = await newPage(viewport);
    await a.page.goto(base + p, { waitUntil: 'networkidle' });
    await input(a.page).waitFor({ timeout: 30000 });
    await shot(a.page, `${tag}-01-empty`, false);
    await a.page.getByRole('button', { name: 'How to play' }).first().click();
    await shot(a.page, `${tag}-02-howto`, false);
    await a.page.keyboard.press('Escape');

    let i = 0;
    for (; i < 3; i++) await guess(a.page, ...POOL[i]);
    await a.page.evaluate(() => window.scrollTo(0, 0));
    await shot(a.page, `${tag}-03-three-takes`, label === 'm390' ? false : false);
    if (label === 'm390') await shot(a.page, `${tag}-03b-three-takes-full`, true);

    if (label === 'm390') {
      await a.page.getByRole('button', { name: /CALL SHEET/ }).click();
      await shot(a.page, `${tag}-04-callsheet`, false);
      await a.page.getByRole('button', { name: /CALL SHEET/ }).click();
    } else {
      await shot(a.page, `${tag}-04-callsheet`, false);
    }

    for (; i < 5; i++) await guess(a.page, ...POOL[i]);
    await a.page.evaluate(() => window.scrollTo(0, 0));
    await shot(a.page, `${tag}-05-notes-unlocked`, false);

    for (; i < POOL.length && !(await finished(a.page).count()); i++) await guess(a.page, ...POOL[i]);
    await finished(a.page).waitFor({ timeout: 15000 });
    await a.page.evaluate(() => window.scrollTo(0, 0));
    await shot(a.page, `${tag}-06-result-loss`, true);

    const answer = (await finished(a.page).locator('p.ty-display').first().textContent())?.trim() ?? '';
    const yearText = (await finished(a.page).locator('p.ty-display + p .tabular-nums').first().textContent())?.trim() ?? '';
    await a.ctx.close();

    // Round 2: a fresh player wins in 3.
    const b = await newPage(viewport);
    await b.page.goto(base + p, { waitUntil: 'networkidle' });
    await input(b.page).waitFor({ timeout: 30000 });
    await guess(b.page, ...POOL[0]);
    await guess(b.page, ...POOL[1]);
    if (answer) await guess(b.page, answer, yearText);
    await finished(b.page).waitFor({ timeout: 15000 }).catch(() => {});
    await b.page.evaluate(() => window.scrollTo(0, 0));
    await shot(b.page, `${tag}-07-result-win`, true);
    await b.ctx.close();
  }
}

await browser.close();
console.log('done', outDir);
