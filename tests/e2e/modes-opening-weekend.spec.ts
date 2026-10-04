// Opening Weekend (Section 5, WS9): higher or lower on worldwide gross. Plays a practice streak with
// the keyboard and a daily run with taps, checks the share line and the one-run-per-day lock, and
// asserts that no pair's gross reached the browser before that pair was answered.
// The test knows the right answer only from the Node-side fixture library (the keyless server's data).
import type { Page, Response } from '@playwright/test';
import { APP_NAME } from '../../src/config/brand';
import { library } from './helpers/answer';
import { test, expect } from './fixtures';

const API = /\/api\/modes\/opening-weekend\/(start|answer|finish)$/;
const grossOf = new Map(library.films.map((f) => [f.id, f.boxOfficeUsd]));
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function nyMonthDay(): string {
  const [y, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date())
    .split('-')
    .map(Number);
  void y;
  return `${MONTHS[m! - 1]} ${d}`;
}

async function cardIds(page: Page): Promise<{ left: number; right: number }> {
  const left = Number(await page.getByTestId('ow-card-left').getAttribute('data-film-id'));
  const right = Number(await page.getByTestId('ow-card-right').getAttribute('data-film-id'));
  return { left, right };
}

async function higher(page: Page): Promise<'left' | 'right'> {
  const { left, right } = await cardIds(page);
  return (grossOf.get(left) ?? 0) > (grossOf.get(right) ?? 0) ? 'left' : 'right';
}

/** Wait until the pair is answerable again (cards enabled after the swap). */
async function ready(page: Page) {
  await expect(page.getByTestId('ow-card-left')).toBeEnabled();
  await expect(page.getByTestId('ow-card-right')).toBeEnabled();
}

function watchBodies(page: Page) {
  const bodies: { url: string; text: string; req: string }[] = [];
  page.on('response', async (r: Response) => {
    if (!API.test(r.url())) return;
    try {
      bodies.push({ url: r.url(), text: await r.text(), req: r.request().postData() ?? '' });
    } catch {
      /* body unavailable */
    }
  });
  return bodies;
}

/** Start and next-pair payloads never carry a gross; only `resolved` does, for the answered pair. */
function expectNoEarlyGrosses(bodies: { url: string; text: string }[]) {
  expect(bodies.length).toBeGreaterThan(0);
  for (const b of bodies) {
    const json = JSON.parse(b.text) as Record<string, unknown>;
    const pairs: Array<{ left: { id: number }; right: { id: number } }> = [];
    if (b.url.endsWith('/start') && json.pair) pairs.push(json.pair as never);
    if (json.next) pairs.push((json.next as { pair: never }).pair);
    const resolvedIds = new Set<number>();
    const res = json.resolved as { left: { id: number }; right: { id: number } } | undefined;
    if (res) [res.left.id, res.right.id].forEach((id) => resolvedIds.add(id));
    for (const p of pairs) {
      expect(JSON.stringify(p)).not.toMatch(/gross|boxOffice/i);
      for (const id of [p.left.id, p.right.id]) {
        if (resolvedIds.has(id)) continue;
        expect(b.text).not.toContain(String(grossOf.get(id)));
      }
    }
  }
}

test('lobby renders at this width without horizontal scroll', async ({ page }) => {
  const doc = await page.goto('/modes/opening-weekend');
  expect(doc?.status()).toBe(200);
  const html = await doc!.text();
  // The page shell carries no grosses at all.
  for (const g of library.films.map((f) => f.boxOfficeUsd).filter(Boolean)) expect(html).not.toContain(String(g));
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/Opening/i);
  await expect(page.getByRole('button', { name: "Start today's run" })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start practice' })).toBeVisible();
  await expect(page.getByTestId('ow-board')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('practice: keyboard play, streak, run over, best streak kept', async ({ page }) => {
  const bodies = watchBodies(page);
  await page.goto('/modes/opening-weekend');
  await page.getByRole('button', { name: 'Start practice' }).click();
  await expect(page.getByTestId('ow-run')).toHaveAttribute('data-mode', 'practice');
  await ready(page);
  // No money on screen before the pick, and the pair fits the viewport.
  await expect(page.getByTestId('ow-run')).not.toContainText('$');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  for (let i = 1; i <= 2; i++) {
    const side = await higher(page);
    await page.keyboard.press(side === 'left' ? 'ArrowLeft' : '2');
    await expect(page.getByTestId('ow-score')).toContainText(`${i} in a row`);
    await ready(page);
  }
  const wrong = (await higher(page)) === 'left' ? 'right' : 'left';
  await page.keyboard.press(wrong === 'left' ? '1' : 'ArrowRight');
  const over = page.getByTestId('ow-over');
  await expect(over).toBeVisible();
  await expect(over).toHaveAttribute('data-outcome', 'wrong');
  await expect(page.getByTestId('ow-final-score')).toHaveText('2');
  await expect(page.getByTestId('ow-run')).toContainText('✗ Your pick');
  await expect(page.getByTestId('ow-run')).toContainText('LOWER');
  await expect(page.getByTestId('ow-run')).toContainText('HIGHER');
  await expect(page.getByTestId('ow-share-text')).toContainText(`${APP_NAME} · Opening Weekend · Practice · 2 in a row`);
  await page.getByRole('button', { name: 'Back to the lobby' }).click();
  await expect(page.getByTestId('ow-best')).toContainText('2');
  expectNoEarlyGrosses(bodies);
});

test('daily run: tap to play, share line, one run per day', async ({ page }) => {
  const bodies = watchBodies(page);
  await page.goto('/modes/opening-weekend');
  await page.getByRole('button', { name: "Start today's run" }).click();
  await expect(page.getByTestId('ow-run')).toHaveAttribute('data-mode', 'daily');
  await expect(page.getByTestId('ow-timer')).toHaveText(/^0:[0-5]\d$|^1:00$/);
  await ready(page);

  const first = await cardIds(page);
  await page.getByTestId(`ow-card-${await higher(page)}`).click();
  await expect(page.getByTestId('ow-score')).toContainText('1 in a row');
  await ready(page);
  const second = await cardIds(page);
  expect(second).not.toEqual(first);
  await page.getByTestId(`ow-card-${await higher(page)}`).click();
  await expect(page.getByTestId('ow-score')).toContainText('2 in a row');
  await ready(page);
  const wrong = (await higher(page)) === 'left' ? 'right' : 'left';
  await page.getByTestId(`ow-card-${wrong}`).click();

  await expect(page.getByTestId('ow-over')).toHaveAttribute('data-outcome', 'wrong');
  const line = `${APP_NAME} · Opening Weekend · ${nyMonthDay()} · 2 in a row`;
  await expect(page.getByTestId('ow-share-text')).toContainText(line);
  await expect(page.getByTestId('ow-share-text')).toContainText('/modes/opening-weekend');
  expectNoEarlyGrosses(bodies);

  // Reload: the day's run is locked in.
  await page.reload();
  const done = page.getByTestId('ow-daily-done');
  await expect(done).toContainText('2 in a row');
  await expect(page.getByRole('button', { name: "Start today's run" })).toHaveCount(0);
  await expect(page.getByTestId('ow-board')).toContainText(/\d+ runs? today/);

  // A direct API call cannot start a second run either.
  const res = await page.request.post('/api/modes/opening-weekend/start', { data: { mode: 'daily' } });
  expect(await res.json()).toMatchObject({ status: 'done', score: 2 });
});
