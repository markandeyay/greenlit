// Pitch flow (Sections 5, 8, 10.5; WS8): create a challenge, a friend plays it in a fresh browser
// context, and the creator sees the friend's result.
import { COPY } from '../../src/config/brand';
import { PITCH } from '../../src/config/game';
import { STORAGE_KEYS } from '../../src/config/game';
import { RULES } from '../../src/config/rules';
import { library, wrongFilms } from './helpers/answer';
import { guessFilm, searchInput, waitForBoard } from './helpers/game';
import { LEADER_INIT, test, expect } from './fixtures';

// A film that is not today's answer is irrelevant here; any playable film works. Pick a distinctive one.
const pitched = library.films.find((f) => f.title === 'Whiplash') ?? library.films[0]!;

test('pitch: create, a friend plays the link in a fresh context, the creator sees the result', async ({ page, browser, baseURL }) => {
  test.setTimeout(120_000);
  await page.goto('/pitch');
  const picker = page.getByRole('combobox', { name: '01 · The film' });
  await picker.click();
  await picker.fill(pitched.title);
  await page.getByRole('option').filter({ hasText: pitched.title }).filter({ hasText: String(pitched.releaseYear) }).first().click();
  await expect(page.getByText(pitched.title, { exact: true }).first()).toBeVisible();
  await page.getByLabel(/Director's note/).fill('Rushing or dragging?');

  const created = page.waitForResponse((r) => r.url().endsWith('/api/pitch') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Create challenge' }).click();
  const res = await created;
  expect(res.status()).toBe(201);
  const { slug, url } = (await res.json()) as { slug: string; url: string };

  // The link is opaque: neither the title nor the TMDB id is derivable from it (Section 10.5).
  const link = page.getByLabel('Challenge link');
  await expect(link).toHaveValue(url);
  expect(url).toContain(`/p/${slug}`);
  expect(slug).not.toMatch(new RegExp(`(^|[^0-9])${pitched.id}([^0-9]|$)`));
  expect(decodeURIComponent(url).toLowerCase()).not.toContain(pitched.title.toLowerCase());
  expect(slug.length).toBeGreaterThanOrEqual(PITCH.slugLength);

  // A friend opens the link in a fresh browser context (no shared cookies).
  const friend = await browser.newContext({
    baseURL,
    viewport: page.viewportSize() ?? undefined,
    extraHTTPHeaders: { 'x-forwarded-for': `10.200.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` },
  });
  await friend.addInitScript(LEADER_INIT, STORAGE_KEYS.leaderSeen);
  try {
    const fp = await friend.newPage();
    const doc = await fp.goto(`/p/${slug}`);
    expect(doc?.status()).toBe(200);
    expect((await doc!.text()).toLowerCase()).not.toContain(pitched.title.toLowerCase());
    await waitForBoard(fp);
    await expect(fp.getByRole('heading', { level: 1 })).toContainText('pitch');
    await expect(searchInput(fp)).toBeVisible();
    // Pitches offer a single note slot (the creator's note) after PITCH.noteUnlockAfter takes.
    await expect(fp.getByText(`Unlocks after take ${PITCH.noteUnlockAfter}`)).toBeVisible();

    const [wrong] = wrongFilms(pitched, 1);
    await guessFilm(fp, wrong!);
    await guessFilm(fp, pitched);
    await expect(fp.getByText(COPY.winStamp, { exact: true })).toBeVisible();
    await expect(fp.getByTestId('share-preview')).toContainText(`Pitch · Take 2/${RULES.maxGuesses}`);
    await expect(fp.getByTestId('share-preview')).toContainText(`/p/${slug}`);

    // The friend cannot read the creator's results.
    const denied = await fp.request.get(`/api/pitch/${encodeURIComponent(slug)}/results`);
    expect(denied.status()).toBe(403);
  } finally {
    await friend.close();
  }

  // Creator: results show the friend's take.
  await page.getByRole('button', { name: 'See how friends did' }).first().click();
  const results = page.locator('table').filter({ has: page.locator('caption', { hasText: 'Results for this pitch' }) });
  await expect(results).toBeVisible();
  const row = results.locator('tbody tr').first();
  await expect(row).toContainText(COPY.winStamp);
  await expect(row).toContainText(`2 / ${RULES.maxGuesses}`);
  await expect(page.getByText('You pitched')).toBeVisible();
});

test('pitch: an unknown slug is a 404', async ({ page }) => {
  const res = await page.goto('/p/not-a-real-pitch-slug');
  expect(res?.status()).toBe(404);
});
