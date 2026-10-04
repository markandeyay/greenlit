// Mobile layout (Sections 6.5, 6.7): no horizontal scroll at 375px, Call Sheet strip on mobile and
// the sticky panel on desktop.
import type { Page } from '@playwright/test';
import { COPY } from '../../src/config/brand';
import { todayAnswer, todayNumber, wrongFilms } from './helpers/answer';
import { guessFilm, playWrong, waitForBoard } from './helpers/game';
import { test, expect } from './fixtures';

const answer = todayAnswer();

/** Elements poking out past the viewport that are not inside a horizontal scroller. */
async function overflow(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const vw = doc.clientWidth;
    const offenders: string[] = [];
    for (const el of Array.from(document.body.querySelectorAll<HTMLElement>('*'))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.right <= vw + 1) continue;
      let p: HTMLElement | null = el.parentElement;
      let clipped = false;
      while (p && p !== document.body) {
        const ox = getComputedStyle(p).overflowX;
        if (ox !== 'visible') {
          clipped = true;
          break;
        }
        p = p.parentElement;
      }
      if (clipped || getComputedStyle(el).position === 'fixed') continue;
      offenders.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)} right=${Math.round(r.right)}`);
    }
    return { scrollWidth: doc.scrollWidth, clientWidth: vw, offenders: offenders.slice(0, 8) };
  });
}

test.describe('375px layout', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'mobile project only');
  });

  const pages = ['/', '/vault', '/pitch', '/stats', '/leaderboard', '/settings', '/how-to-play', '/modes'];
  for (const path of pages) {
    test(`no horizontal scroll on ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const o = await overflow(page);
      expect(o.scrollWidth, JSON.stringify(o.offenders)).toBeLessThanOrEqual(o.clientWidth);
    });
  }

  for (const width of [375, 390]) {
    test(`the header fits inside ${width}px with every control visible`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/modes');
      await page.waitForLoadState('networkidle');
      const r = await page.evaluate(() => {
        const vw = window.innerWidth;
        const out: string[] = [];
        for (const el of Array.from(document.querySelectorAll<HTMLElement>('header.gl-header *'))) {
          if (el.closest('[hidden]')) continue;
          const b = el.getBoundingClientRect();
          if (b.width > 0 && b.right > vw + 0.5) out.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)} right=${Math.round(b.right)}`);
        }
        return { vw, out, scrollWidth: document.documentElement.scrollWidth };
      });
      expect(r.out, r.out.join('\n')).toEqual([]);
      expect(r.scrollWidth).toBeLessThanOrEqual(r.vw);
      for (const name of ['How to play', 'Stats', 'Settings']) {
        await expect(page.getByRole('banner').getByRole('link', { name })).toBeInViewport();
      }
      await expect(page.getByRole('button', { name: 'Open menu' })).toBeInViewport();
    });
  }

  test('no horizontal scroll mid-round, on the result card, and on a Vault reel', async ({ page }) => {
    await page.goto('/');
    await waitForBoard(page);
    await playWrong(page, wrongFilms(answer, 2));
    let o = await overflow(page);
    expect(o.scrollWidth, JSON.stringify(o.offenders)).toBeLessThanOrEqual(o.clientWidth);
    await page.getByRole('button', { name: /CALL SHEET/ }).click();
    o = await overflow(page);
    expect(o.scrollWidth, JSON.stringify(o.offenders)).toBeLessThanOrEqual(o.clientWidth);
    await guessFilm(page, answer);
    await expect(page.getByText(COPY.winStamp, { exact: true })).toBeVisible();
    o = await overflow(page);
    expect(o.scrollWidth, JSON.stringify(o.offenders)).toBeLessThanOrEqual(o.clientWidth);

    if (todayNumber() > 1) {
      await page.goto(`/vault/${todayNumber() - 1}`);
      await waitForBoard(page);
      o = await overflow(page);
      expect(o.scrollWidth, JSON.stringify(o.offenders)).toBeLessThanOrEqual(o.clientWidth);
    }
  });

  test('the Call Sheet strip toggles open and closed', async ({ page }) => {
    await page.goto('/');
    await waitForBoard(page);
    await expect(page.getByRole('button', { name: /CALL SHEET/ })).toHaveCount(0);
    await playWrong(page, wrongFilms(answer, 2));
    const strip = page.getByRole('button', { name: /CALL SHEET/ });
    await expect(strip).toBeVisible();
    await expect(strip).toHaveAttribute('aria-expanded', 'false');
    await expect(strip).toContainText('confirmed');
    const panelId = await strip.getAttribute('aria-controls');
    const panel = page.locator(`[id="${panelId}"]`);
    await expect(panel).toBeHidden();

    await strip.click();
    await expect(strip).toHaveAttribute('aria-expanded', 'true');
    await expect(panel).toBeVisible();
    await expect(panel).toBeFocused();
    await expect(panel).toContainText(/Year/);

    await page.keyboard.press('Escape');
    await expect(strip).toHaveAttribute('aria-expanded', 'false');
    await expect(panel).toBeHidden();
    await expect(strip).toBeFocused();

    await strip.click();
    await expect(panel).toBeVisible();
    await strip.click();
    await expect(panel).toBeHidden();
    // The desktop panel is not shown at this width.
    await expect(page.getByRole('complementary', { name: COPY.callSheet })).toBeHidden();
  });
});

test.describe('desktop layout', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop project only');
  });

  test('the Call Sheet is a sticky side panel and the strip is hidden', async ({ page }) => {
    await page.goto('/');
    await waitForBoard(page);
    await guessFilm(page, wrongFilms(answer, 1)[0]!);
    const aside = page.getByRole('complementary', { name: COPY.callSheet });
    await expect(aside).toBeVisible();
    await expect(aside).toContainText(COPY.callSheet);
    await expect(page.getByRole('button', { name: /CALL SHEET/ })).toBeHidden();
  });
});

test('loading the board does not shift the page (CLS)', async ({ page }) => {
  // Slow the play-state fetch so the loading placeholder is on screen long enough to matter.
  await page.route('**/api/play?*', async (route) => {
    await new Promise((r) => setTimeout(r, 400));
    await route.continue();
  });
  await page.goto('/');
  await waitForBoard(page);
  await page.getByText('Guess any movie to start').waitFor();
  const cls = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let total = 0;
        new PerformanceObserver((list) => {
          for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) {
            if (!e.hadRecentInput) total += e.value;
          }
        }).observe({ type: 'layout-shift', buffered: true });
        setTimeout(() => resolve(total), 300);
      }),
  );
  expect(cls).toBeLessThan(0.05);
});
