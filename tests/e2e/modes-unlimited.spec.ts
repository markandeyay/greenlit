// Dailies Reel (Unlimited, Section 5, WS9): pick a band, play a round with the classic board,
// walk away, check the reveal and share, resume after reload, then roll the next reel. Also
// asserts the answer never reached the page (HTML or game API bodies) before the reveal.
import type { Response } from '@playwright/test';
import { COPY } from '../../src/config/brand';
import { RULES } from '../../src/config/rules';
import { library } from './helpers/answer';
import { guessFilm, searchInput, takeRows, waitForBoard } from './helpers/game';
import { test, expect } from './fixtures';

const GAME_API = /\/api\/(modes\/unlimited\/new|play|guess|hint)/;

test('dailies reel: roll, play, walk away, resume, next reel', async ({ page }) => {
  test.setTimeout(120_000);
  const bodies: { url: string; text: string }[] = [];
  const onResponse = async (r: Response) => {
    if (!GAME_API.test(r.url())) return;
    try {
      bodies.push({ url: r.url(), text: await r.text() });
    } catch {
      /* body unavailable (redirect or aborted) */
    }
  };
  page.on('response', onResponse);

  const doc = await page.goto('/modes/unlimited');
  expect(doc?.status()).toBe(200);
  const html = (await doc!.text()).toLowerCase();

  await expect(page.getByRole('heading', { level: 1 })).toContainText(/Dailies/i);
  // Band picker: native radios, keyboard operable, state shown by a check (not color alone).
  const popular = page.getByRole('radio', { name: /Popular/ });
  await expect(popular).toBeChecked();
  await popular.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: /Cinephile/ })).toBeChecked();

  const dealt = page.waitForResponse((r) => r.url().endsWith('/api/modes/unlimited/new') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Roll the reel' }).click();
  const dealRes = await dealt;
  expect(dealRes.status()).toBe(200);
  const { ref } = (await dealRes.json()) as { ref: string };
  expect(ref).toMatch(/^[A-Za-z0-9_-]{20,}$/);

  await waitForBoard(page);
  await expect(searchInput(page)).toBeVisible();
  await expect(page.getByText('Dailies reel', { exact: true }).first()).toBeVisible();

  // One take. The guess could be the answer by chance; then the round is already won.
  const guess = library.films.find((f) => f.isPlayable && f.title === 'Whiplash') ?? library.films.find((f) => f.isPlayable)!;
  await guessFilm(page, guess);
  await expect(takeRows(page)).toHaveCount(1);

  const card = page.locator('section').filter({ has: page.getByText('INT. THE SCREENING ROOM - NIGHT') }).first();
  let revealed: { filmId: number; title: string };
  if (await page.getByText(COPY.winStamp, { exact: true }).isVisible()) {
    const last = bodies.filter((b) => b.url.includes('/api/guess')).at(-1)!;
    revealed = (JSON.parse(last.text) as { reveal: { filmId: number; title: string } }).reveal;
  } else {
    await page.getByRole('button', { name: COPY.giveUp }).click();
    const gave = page.waitForResponse((r) => r.url().includes('/api/giveup'));
    await page.getByRole('alertdialog').getByRole('button', { name: COPY.giveUp }).click();
    revealed = ((await (await gave).json()) as { reveal: { filmId: number; title: string } }).reveal;
    await expect(card.getByText(COPY.lossStamp, { exact: true })).toBeVisible();
    await expect(page.getByTestId('share-preview')).toContainText(`Dailies Reel · Take X/${RULES.maxGuesses}`);
  }
  await expect(card.getByText(revealed.title, { exact: true }).first()).toBeVisible();
  await expect(page.getByTestId('share-preview')).toContainText('/modes/unlimited');
  await expect(page.getByTestId('share-preview')).not.toContainText(ref);
  // No daily distribution or percentile on a practice reel.
  await expect(page.getByText(/You beat \d+% of players/)).toHaveCount(0);

  // Leak check: before the reveal, neither the page HTML nor any game API body named the film.
  const idRe = new RegExp(`\\b${revealed.filmId}\\b`);
  const titleLower = revealed.title.toLowerCase();
  // Very short titles ("Up", "Heat") would match ordinary words, so only distinctive ones are scanned.
  const scanTitle = titleLower.length >= 6;
  const isRevealing = (b: { url: string; text: string }) =>
    b.url.includes('/api/giveup') || (b.text.includes('"reveal"') && b.url.includes('/api/guess'));
  for (const b of bodies.filter((x) => !isRevealing(x))) {
    if (b.url.includes('/api/guess') && guess.id === revealed.filmId) continue;
    if (scanTitle && !b.url.includes('/api/guess')) expect(b.text.toLowerCase(), b.url).not.toContain(titleLower);
    expect(b.text, b.url).not.toMatch(idRe);
  }
  if (scanTitle) expect(html).not.toContain(titleLower);
  expect(html).not.toMatch(idRe);

  // Reload: the finished reel is remembered on this device.
  await page.reload();
  await waitForBoard(page);
  await expect(page.getByRole('button', { name: 'Next reel' })).toBeVisible();

  // Next reel: a fresh ref and an empty board.
  const next = page.waitForResponse((r) => r.url().endsWith('/api/modes/unlimited/new') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Next reel' }).click();
  const nextRes = await next;
  expect(nextRes.status()).toBe(200);
  const nextRef = ((await nextRes.json()) as { ref: string }).ref;
  expect(nextRef).not.toBe(ref);
  await expect(searchInput(page)).toBeVisible();
  await expect(takeRows(page)).toHaveCount(0);
  page.off('response', onResponse);
});

test('dailies reel: a bad stored reel falls back to the band picker', async ({ page }) => {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem('gl_unlimited', JSON.stringify({ ref: 'notARealReelRef', band: 'popular' }));
    } catch {
      /* ignore */
    }
  });
  await page.goto('/modes/unlimited');
  await expect(page.getByRole('button', { name: 'Roll the reel' })).toBeVisible();
});
