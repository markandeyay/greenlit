// Logline mode (WS9) end to end, at desktop and 375px (projects "desktop" and "mobile").
// Flow: tiers sharpen one per miss, the round resumes after a reload, a loss reveals the film,
// and a second player then wins in one keyboard-only take. Every logline API body and page HTML
// received before the reveal is checked for the revealed title (no early leak).
import type { BrowserContext, Page, Response } from '@playwright/test';
import { LOGLINE } from '../../src/config/modes';
import { STORAGE_KEYS } from '../../src/config/game';
import type { Film } from '../../src/lib/types';
import fixture from '../../src/server/db/fixtures/library.json';
import { LEADER_INIT, expect, test } from './fixtures';

const films = (fixture as { films: Film[] }).films.filter((f) => f.isPlayable);
// Plain, distinct titles that are easy to pick from the list.
const CANDIDATES = ['Fargo', 'Jaws', 'Rocky', 'Titanic', 'Gladiator', 'Whiplash', 'Arrival', 'Parasite']
  .map((t) => films.find((f) => f.title === t))
  .filter((f): f is Film => !!f);

function input(page: Page) {
  return page.getByRole('combobox', { name: /Name the film/i });
}
const tiers = (page: Page) => page.getByTestId('logline-tier');
const finished = (page: Page) => page.getByTestId('logline-reveal-title');

async function open(page: Page) {
  await page.goto('/modes/logline');
  await expect(page.getByRole('heading', { level: 1, name: /logline/i })).toBeVisible();
  await expect(tiers(page).first()).toBeVisible();
}

async function guess(page: Page, film: Film) {
  const field = input(page);
  await field.click();
  await field.fill(film.title);
  const option = page.getByRole('option').filter({ hasText: film.title }).filter({ hasText: String(film.releaseYear) }).first();
  await expect(option).toBeVisible();
  const res = page.waitForResponse((r) => r.url().includes('/api/modes/logline/guess') && r.request().method() === 'POST');
  await option.click();
  expect((await res).status()).toBe(200);
}

function recordBodies(page: Page): { bodies: string[]; stop: () => void } {
  const bodies: string[] = [];
  const onResponse = async (r: Response) => {
    const url = r.url();
    if (!url.includes('/api/modes/logline') && !url.includes('/modes/logline')) return;
    try {
      bodies.push(await r.text());
    } catch {
      /* navigated away */
    }
  };
  page.on('response', onResponse);
  return { bodies, stop: () => page.off('response', onResponse) };
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

test('logline: tiers sharpen per miss, resume after reload, reveal at the end, then a one take win', async ({ page, browser }, testInfo) => {
  test.setTimeout(120_000);
  const rec = recordBodies(page);
  await open(page);
  await expect(tiers(page)).toHaveCount(1);
  await expect(page.getByTestId('logline-take')).toHaveText(/TAKE 1 \/ 6/);
  await expectNoHorizontalScroll(page);

  let take = 0;
  let won = false;
  for (const film of CANDIDATES.slice(0, LOGLINE.maxTakes)) {
    await guess(page, film);
    take++;
    if (await finished(page).isVisible()) {
      won = (await page.getByTestId('logline-share-text').textContent())?.includes('🟩') ?? false;
      break;
    }
    await expect(tiers(page)).toHaveCount(Math.min(LOGLINE.tiers, take + 1));
    if (take === 2) {
      // Resume: the round survives a reload.
      await page.reload();
      await expect(tiers(page)).toHaveCount(3);
      await expect(page.getByRole('complementary').getByText(CANDIDATES[0]!.title)).toBeVisible();
    }
  }
  await expect(finished(page)).toBeVisible();
  const revealText = (await finished(page).textContent()) ?? '';
  const title = films
    .filter((f) => revealText.startsWith(f.title))
    .sort((a, b) => b.title.length - a.title.length)[0]!.title;
  rec.stop();

  // Only the response that finished the round (it carries the reveal) may name the film.
  expect(rec.bodies.length).toBeGreaterThan(take);
  for (const body of rec.bodies.filter((b) => !b.includes('"reveal":'))) expect(body).not.toContain(title);

  // All drafts are shown, and the share text is spoiler free.
  await expect(tiers(page)).toHaveCount(LOGLINE.tiers);
  const share = (await page.getByTestId('logline-share-text').textContent()) ?? '';
  expect(share).not.toContain(title);
  expect(share).toMatch(/· Logline · [A-Z][a-z]{2} \d{1,2} · (\d|X)\/6/);
  expect(share).toContain('/modes/logline');
  if (!won) {
    expect(share).toContain('X/6');
    expect(share).toContain('🟥'.repeat(LOGLINE.maxTakes));
  }
  await expectNoHorizontalScroll(page);
  if (won) return; // a candidate happened to be today's film; the win path is covered already

  // A second player (fresh cookies) names it in one take, keyboard only.
  const ctx: BrowserContext = await browser.newContext({
    viewport: page.viewportSize() ?? undefined,
    extraHTTPHeaders: { 'x-forwarded-for': `10.77.${testInfo.project.name.length}.9` },
  });
  await ctx.addInitScript(LEADER_INIT, STORAGE_KEYS.leaderSeen);
  const p2 = await ctx.newPage();
  await open(p2);
  await input(p2).focus();
  await p2.keyboard.type(title, { delay: 10 });
  const field = input(p2);
  await expect(field).toHaveAttribute('aria-expanded', 'true');
  for (let i = 0; i < 10; i++) {
    const activeId = await field.getAttribute('aria-activedescendant');
    const optTitle = activeId ? ((await p2.locator(`[id="${activeId}"] .gm-search__title`).textContent()) ?? '') : '';
    if (optTitle.trim() === title) break;
    await p2.keyboard.press('ArrowDown');
  }
  await p2.keyboard.press('Enter');
  await expect(finished(p2)).toBeVisible();
  await expect(p2.getByRole('heading', { name: /Sold on take 1/ })).toBeVisible();
  const share2 = (await p2.getByTestId('logline-share-text').textContent()) ?? '';
  expect(share2).toContain('1/6');
  expect(share2).toContain('🟩');
  await ctx.close();
});
