// Release Order (WS9) end to end, desktop and 375px. The truth is computed Node side from the
// fixture library with the same pure logic the server uses; the browser never receives it early.
import type { Page, Response } from '@playwright/test';
import { APP_NAME, COPY } from '../../src/config/brand';
import { RELEASE_ORDER } from '../../src/config/modes';
import { dateInResetZone } from '../../src/lib/dates';
import type { Film } from '../../src/lib/types';
import { pickDailySet, servedOrder, trueOrder } from '../../src/server/modes/release-order/logic';
import fixtureLibrary from '../../src/server/db/fixtures/library.json';
import { test, expect } from './fixtures';

const PATH = '/modes/release-order';
const API = '/api/modes/release-order';

function todaySet() {
  const films = (fixtureLibrary as { films: Film[] }).films;
  const date = dateInResetZone();
  const set = pickDailySet(films, date)!;
  const ids = servedOrder(set.map((f) => f.id), date);
  const served = ids.map((id) => set.find((f) => f.id === id)!);
  const truth = trueOrder(set).map((id) => served.find((f) => f.id === id)!);
  return { served, truth };
}

async function titles(page: Page): Promise<string[]> {
  return (await page.getByTestId('ro-title').allInnerTexts()).map((t) => t.replace(/^Position \d+:\s*/, '').trim());
}

/** Reorder with the Move up buttons only, driven from the keyboard. */
async function sortWithKeyboard(page: Page, wanted: string[]) {
  for (let i = 0; i < wanted.length; i++) {
    let current = await titles(page);
    while (current.indexOf(wanted[i]!) > i) {
      const btn = page.getByRole('button', { name: `Move ${wanted[i]} up`, exact: true });
      await btn.focus();
      await page.keyboard.press('Enter');
      current = await titles(page);
    }
  }
  expect(await titles(page)).toEqual(wanted);
}

async function noHorizontalScroll(page: Page) {
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(sw).toBeLessThanOrEqual(cw + 1);
}

test.describe('Release Order', () => {
  test('plays a full round: no dates before the end, per slot feedback, win, share, resume', async ({ page }) => {
    const { served, truth } = todaySet();
    const bodies: string[] = [];
    page.on('response', async (res: Response) => {
      if (res.url().includes(API)) bodies.push(await res.text().catch(() => ''));
    });

    await page.goto(PATH);
    await expect(page.getByTestId('ro-item')).toHaveCount(RELEASE_ORDER.filmsPerSet);
    expect(await titles(page)).toEqual(served.map((f) => f.title));
    await expect(page.getByTestId('ro-take')).toHaveText(COPY.takeLabel(1, RELEASE_ORDER.maxAttempts));

    // Take 1: the truth rotated by one, so nothing is in the right slot.
    const rotated = [...truth.slice(1), truth[0]!].map((f) => f.title);
    await sortWithKeyboard(page, rotated);
    await page.getByRole('button', { name: 'Lock this order' }).click();
    await expect(page.getByTestId('ro-attempt')).toHaveCount(1);
    await expect(page.getByTestId('ro-take')).toHaveText(COPY.takeLabel(2, RELEASE_ORDER.maxAttempts));
    await expect(page.getByTestId('ro-attempt').first()).toContainText('0 in the right slot');
    // Per slot chips: glyph plus words on every row, none right.
    await expect(page.getByTestId('ro-chip')).toHaveCount(RELEASE_ORDER.filmsPerSet);
    await expect(page.getByTestId('ro-chip').filter({ hasText: 'Right spot' })).toHaveCount(0);

    // Nothing date-like reached the browser before the round ended.
    const text = await page.locator('main').innerText();
    for (const f of served) {
      expect(text).not.toContain(String(f.releaseYear));
      for (const b of bodies) {
        expect(b).not.toContain(String(f.releaseYear));
        expect(b).not.toMatch(/releaseDate|releaseYear/);
      }
    }
    if (test.info().project.name === 'mobile') await noHorizontalScroll(page);

    // Take 2: the true order.
    await sortWithKeyboard(page, truth.map((f) => f.title));
    await page.getByRole('button', { name: 'Lock this order' }).click();
    await expect(page.getByTestId('ro-result')).toContainText(COPY.winStamp);
    const reveal = page.getByTestId('ro-reveal');
    await expect(reveal.getByTestId('ro-reveal-date').first()).toContainText(String(truth[0]!.releaseYear));
    // The share artifact's emoji text rides on the panel wrapper whatever the panel renders.
    const share = page.getByTestId('ro-share');
    await expect(share).toBeVisible();
    const shared = (await share.getAttribute('data-share-text')) ?? '';
    expect(shared).toContain(`${APP_NAME} · Release Order ·`);
    expect(shared).toContain('· 2/3');
    expect(shared).toContain('🟩🟩🟩🟩🟩');
    expect(shared).toContain('/modes/release-order');
    for (const f of served) {
      expect(shared).not.toContain(f.title);
      expect(shared).not.toContain(String(f.releaseYear));
    }
    if (test.info().project.name === 'mobile') await noHorizontalScroll(page);

    // Reload: the round stays finished (one round per player per day).
    await page.reload();
    await expect(page.getByTestId('ro-result')).toContainText(COPY.winStamp);
    await expect(page.getByRole('button', { name: 'Lock this order' })).toHaveCount(0);
  });

  test('drags a film with the pointer and resumes an unfinished round after reload', async ({ page }) => {
    await page.goto(PATH);
    await expect(page.getByTestId('ro-item')).toHaveCount(RELEASE_ORDER.filmsPerSet);
    const before = await titles(page);
    const grip = page.getByTestId('ro-grip').first();
    const last = page.getByTestId('ro-item').last();
    const g = (await grip.boundingBox())!;
    const l = (await last.boundingBox())!;
    await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
    await page.mouse.down();
    await page.mouse.move(g.x + g.width / 2, l.y + l.height / 2, { steps: 12 });
    await page.mouse.move(g.x + g.width / 2, l.y + l.height - 2, { steps: 4 });
    await page.mouse.up();
    await expect.poll(() => titles(page)).toEqual([...before.slice(1), before[0]!]);

    await page.getByRole('button', { name: 'Lock this order' }).click();
    await expect(page.getByTestId('ro-attempt')).toHaveCount(1);
    const status = await page.getByTestId('ro-game').getAttribute('data-status');
    await page.reload();
    await expect(page.getByTestId('ro-attempt')).toHaveCount(1);
    await expect(page.getByTestId('ro-game')).toHaveAttribute('data-status', status!);
    if (test.info().project.name === 'mobile') await noHorizontalScroll(page);
  });
});
