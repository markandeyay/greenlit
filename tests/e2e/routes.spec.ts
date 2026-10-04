// Routing, Vault and leaderboard surfaces (Sections 3, 7.1, 9, 10.4; WS5, WS7).
import { APP_NAME, COPY } from '../../src/config/brand';
import { LEADERBOARD } from '../../src/config/game';
import { puzzleFilm, todayAnswer, todayNumber, wrongFilms } from './helpers/answer';
import { guessFilm, searchInput, waitForBoard } from './helpers/game';
import { test, expect } from './fixtures';

const today = todayNumber();

test.describe('share-link redirects', () => {
  test('/<today> redirects to /', async ({ page }) => {
    await page.goto(`/${today}`);
    await expect(page).toHaveURL(/\/$/);
    await waitForBoard(page);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(COPY.reelLabel(today));
  });

  test('/<past> redirects to /vault/<n>', async ({ page }) => {
    test.skip(today < 2, 'needs at least one past reel');
    await page.goto(`/${today - 1}`);
    await expect(page).toHaveURL(new RegExp(`/vault/${today - 1}$`));
  });

  test('/<future> and nonsense numbers are 404s', async ({ page }) => {
    expect((await page.goto(`/${today + 1}`))?.status()).toBe(404);
    expect((await page.goto('/0'))?.status()).toBe(404);
  });
});

test.describe('vault', () => {
  test('lists released past reels only', async ({ page }) => {
    await page.goto('/vault');
    for (let n = 1; n < today; n++) await expect(page.locator(`a[href="/vault/${n}"]`).first()).toBeVisible();
    await expect(page.locator(`a[href="/vault/${today}"]`)).toHaveCount(0);
    await expect(page.locator(`a[href="/vault/${today + 1}"]`)).toHaveCount(0);
  });

  test('a past reel is playable to the end with vault copy', async ({ page }) => {
    test.skip(today < 2, 'needs at least one past reel');
    const n = today - 1;
    const film = puzzleFilm(n);
    await page.goto(`/vault/${n}`);
    await waitForBoard(page);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(COPY.reelLabel(n));
    await expect(page.getByText('From the Vault · No leaderboard credit')).toBeVisible();
    await guessFilm(page, wrongFilms(film, 1)[0]!);
    await guessFilm(page, film);
    await expect(page.getByText(COPY.winStamp, { exact: true })).toBeVisible();
    await expect(page.getByText('no leaderboard credit', { exact: false }).last()).toBeVisible();
    await expect(page.getByTestId('share-preview')).toContainText(`/vault/${n}`);
  });

  test('today and future reels are not in the Vault', async ({ page }) => {
    expect((await page.goto(`/vault/${today}`))?.status()).toBe(404);
    expect((await page.goto(`/vault/${today + 1}`))?.status()).toBe(404);
    expect((await page.goto('/vault/abc'))?.status()).toBe(404);
  });

  test('the daily kind only accepts today; past refs must use the vault kind', async ({ page }) => {
    test.skip(today < 2, 'needs at least one past reel');
    await page.goto('/');
    const res = await page.request.post('/api/guess', {
      data: { kind: 'daily', ref: String(today - 1), filmId: wrongFilms(todayAnswer(), 1)[0]!.id },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
    const future = await page.request.post('/api/guess', {
      data: { kind: 'vault', ref: String(today + 1), filmId: wrongFilms(todayAnswer(), 1)[0]!.id },
    });
    expect(future.status()).toBeGreaterThanOrEqual(400);
  });
});

test.describe('today API', () => {
  test('exposes only number, date, theme and next reset', async ({ request }) => {
    const res = await request.get('/api/today');
    expect(res.status()).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['date', 'nextResetAt', 'number', 'theme']);
    expect(body.number).toBe(today);
  });

  test('a fresh play state is empty', async ({ request }) => {
    const res = await request.get(`/api/play?kind=daily&ref=${today}`);
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { status: string; take: number; feedback: unknown[]; reveal?: unknown };
    expect(body.status).toBe('in_progress');
    expect(body.take).toBe(0);
    expect(body.feedback).toEqual([]);
    expect(body.reveal).toBeUndefined();
  });
});

test.describe('leaderboard', () => {
  test('page renders the period tabs, the No notes filter and the empty state in keyless mode', async ({ page }) => {
    await page.goto('/leaderboard');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Leaderboard');
    await expect(page.getByText(`Play ${LEADERBOARD.weeklyMinDailies} of the last ${LEADERBOARD.weeklyWindowDays} daily reels`)).toBeVisible();
    const tabs = page.getByRole('tablist', { name: 'Leaderboard period' });
    await expect(tabs.getByRole('tab')).toHaveText(['Weekly', 'All time', 'Streaks']);
    await expect(tabs.getByRole('tab', { name: 'Weekly' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('The credits are blank')).toBeVisible();
    await expect(page.getByRole('switch', { name: /No notes/ })).toBeVisible();

    // Arrow keys move between tabs (roving tabindex).
    await tabs.getByRole('tab', { name: 'Weekly' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(tabs.getByRole('tab', { name: 'All time' })).toHaveAttribute('aria-selected', 'true');
    await expect(tabs.getByRole('tab', { name: 'All time' })).toBeFocused();
    await expect(page.getByText('The credits are blank')).toBeVisible();
    await page.getByRole('switch', { name: /No notes/ }).click();
    await expect(page.getByRole('switch', { name: /No notes/ })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByText('The credits are blank')).toBeVisible();
  });

  test('API validates params and returns rows for every period', async ({ request }) => {
    // Rule logic (3 of 7 weekly, loss = 11, no-notes filter, anti-cheat flags) is unit tested in
    // tests/unit/accounts/leaderboard.test.ts; this checks the HTTP contract in keyless mode.
    for (const period of ['week', 'all', 'streak'] as const) {
      for (const noNotes of ['true', 'false']) {
        const res = await request.get(`/api/leaderboard?period=${period}&noNotes=${noNotes}`);
        expect(res.status()).toBe(200);
        const body = (await res.json()) as { period: string; noNotes: boolean; rows: unknown[] };
        expect(body.period).toBe(period);
        expect(body.noNotes).toBe(noNotes === 'true');
        expect(Array.isArray(body.rows)).toBe(true);
        // Anonymous plays never count (Section 10.6), and keyless mode has no accounts.
        expect(body.rows).toEqual([]);
      }
    }
    const def = await request.get('/api/leaderboard');
    expect(def.status()).toBe(200);
    expect(((await def.json()) as { period: string }).period).toBe('week');
    for (const bad of ['period=month', 'period=week&noNotes=maybe']) {
      const res = await request.get(`/api/leaderboard?${bad}`);
      expect(res.status()).toBe(400);
      expect(((await res.json()) as { error: { code: string } }).error.code).toBe('bad_request');
    }
  });

  test('an anonymous win today does not put anyone on the board', async ({ page }) => {
    const answer = todayAnswer();
    await page.goto('/');
    await waitForBoard(page);
    await expect(searchInput(page)).toBeVisible();
    await guessFilm(page, answer);
    await expect(page.getByText(COPY.winStamp, { exact: true })).toBeVisible();
    const res = await page.request.get('/api/leaderboard?period=all&noNotes=false');
    expect(((await res.json()) as { rows: unknown[] }).rows).toEqual([]);
  });
});

test.describe('copy', () => {
  for (const path of ['/', '/how-to-play', '/vault', '/pitch', '/stats', '/settings', '/leaderboard', '/modes']) {
    test(`no em dashes and the product name on ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const text = await page.locator('body').innerText();
      expect(text).not.toContain('—');
      expect(await page.title()).toContain(APP_NAME);
    });
  }
});
