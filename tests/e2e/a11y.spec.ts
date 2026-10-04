// Accessibility smoke and keyboard-only play (Sections 6.6, 6.7; WS5 acceptance).
import { test as base } from '@playwright/test';
import { COPY } from '../../src/config/brand';
import { todayAnswer, wrongFilms } from './helpers/answer';
import { guessFilm, guessFilmByKeyboard, searchInput, takeRows, waitForBoard } from './helpers/game';
import { test, expect } from './fixtures';

const answer = todayAnswer();

test('keyboard only: Tab to the search, type, Enter to shoot, Walk away dialog, then win', async ({ page }) => {
  await page.goto('/');
  await waitForBoard(page);
  const input = searchInput(page);
  await expect(input).toBeVisible();

  // Reach the search with Tab alone (the board may already have focused it on fine pointers).
  for (let i = 0; i < 40 && !(await input.evaluate((el) => el === document.activeElement)); i++) {
    await page.keyboard.press('Tab');
  }
  await expect(input).toBeFocused();

  const wrong = wrongFilms(answer, 2);
  await guessFilmByKeyboard(page, wrong[0]!);
  await expect(input).toBeFocused();
  await guessFilmByKeyboard(page, wrong[1]!);

  // Walk away is reachable by Tab, opens an alertdialog with focus on the safe choice, Escape cancels.
  const walk = page.getByRole('button', { name: COPY.giveUp });
  for (let i = 0; i < 40 && !(await walk.evaluate((el) => el === document.activeElement)); i++) {
    await page.keyboard.press('Tab');
  }
  await expect(walk).toBeFocused();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Keep rolling' })).toBeFocused();
  // Focus is trapped inside the dialog.
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: COPY.giveUp })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Keep rolling' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(walk).toBeFocused();

  // "/" jumps back to the search from anywhere.
  await page.keyboard.press('/');
  await expect(input).toBeFocused();
  await guessFilmByKeyboard(page, answer);

  await expect(page.getByText(COPY.winStamp, { exact: true })).toBeVisible();
  // Focus moves to the result heading so screen reader and keyboard users land on the outcome.
  await expect(page.getByRole('heading', { level: 2, name: new RegExp(COPY.winStamp) })).toBeFocused();
  // The share actions are reachable by keyboard.
  const copy = page.getByRole('button', { name: 'Copy text' });
  for (let i = 0; i < 40 && !(await copy.evaluate((el) => el === document.activeElement)); i++) {
    await page.keyboard.press('Tab');
  }
  await expect(copy).toBeFocused();
});

test('every game cell has an aria-label and matches carry a glyph, not just color', async ({ page }) => {
  await page.goto('/');
  await waitForBoard(page);
  await guessFilm(page, wrongFilms(answer, 1)[0]!);
  await guessFilm(page, answer);
  const rows = takeRows(page);
  await expect(rows).toHaveCount(2);
  for (let r = 0; r < 2; r++) {
    const cells = rows.nth(r).locator('[data-verdict][role="img"], .gl-cell, .gm-info-cell');
    // Director, lead, 4 supporting, year, box office, score, rating, studio, genre count.
    expect(await cells.count()).toBe(6 + 6);
    for (const label of await cells.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''))) {
      expect(label.trim().length).toBeGreaterThan(3);
    }
  }
  // The winning row: every non-empty cell is a match and shows the ✓ glyph.
  const winning = rows.filter({ hasText: answer.title }).first();
  const matchCells = winning.locator('[data-verdict="match"]');
  expect(await matchCells.count()).toBeGreaterThan(5);
  const yearCell = winning.locator('[role="img"][aria-label^="Year"]');
  await expect(yearCell).toHaveAttribute('aria-label', /match/i);
  await expect(yearCell).toContainText('✓');
  // Genre chips speak their verdict in text.
  await expect(winning.getByRole('list', { name: 'Genres' }).locator('li').first()).toContainText(/match/i);
});

test('focus is visible on keyboard navigation', async ({ page }) => {
  await page.goto('/how-to-play');
  const seen: string[] = [];
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const cs = getComputedStyle(el);
      const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none';
      return { tag: el.tagName, text: (el.textContent ?? '').trim().slice(0, 30), ring, visible: el.matches(':focus-visible') };
    });
    if (!info) continue;
    seen.push(`${info.tag}:${info.text}`);
    expect(info.visible, `${info.tag} "${info.text}" should match :focus-visible`).toBe(true);
    expect(info.ring, `${info.tag} "${info.text}" has no focus ring`).toBe(true);
  }
  expect(seen.length).toBeGreaterThan(3);
});

test('the search field shows a focus ring on its frame', async ({ page }) => {
  await page.goto('/');
  await waitForBoard(page);
  await searchInput(page).focus();
  const shadow = await page.locator('.gm-search__field').evaluate((el) => getComputedStyle(el).boxShadow);
  expect(shadow).not.toBe('none');
});

base.describe('reduced motion', () => {
  base.use({ reducedMotion: 'reduce' });

  base('no Leader intro and no long-running animations under prefers-reduced-motion', async ({ page }) => {
    // No gl_leader in storage: only the media query keeps the Leader away.
    await page.goto('/');
    await expect(page.getByTestId('leader')).toHaveCount(0);
    await waitForBoard(page);
    await guessFilm(page, wrongFilms(answer, 1)[0]!);
    await guessFilm(page, answer);
    await expect(page.getByText(COPY.winStamp, { exact: true })).toBeVisible();
    const long = await page.evaluate(() =>
      document
        .getAnimations()
        .map((a) => {
          const t = a.effect?.getComputedTiming();
          return {
            name: (a as CSSAnimation).animationName ?? a.constructor.name,
            state: a.playState,
            duration: Number(t?.duration ?? 0),
            iterations: Number(t?.iterations ?? 1),
            delay: Number(t?.delay ?? 0),
          };
        })
        .filter((a) => a.state === 'running' && (a.duration > 50 || a.iterations === Infinity || a.delay > 50)),
    );
    expect(long, JSON.stringify(long)).toEqual([]);
  });
});

base.describe('leader intro', () => {
  base('plays on the first visit of the day, is aria-hidden, and any key skips it', async ({ page }) => {
    await page.goto('/');
    const leader = page.getByTestId('leader');
    await expect(leader).toBeVisible();
    await expect(leader).toHaveAttribute('aria-hidden', 'true');
    await page.keyboard.press('Shift');
    await expect(leader).toHaveCount(0);
    // Second visit the same day: no leader.
    await page.reload();
    await waitForBoard(page);
    await expect(page.getByTestId('leader')).toHaveCount(0);
  });
});
