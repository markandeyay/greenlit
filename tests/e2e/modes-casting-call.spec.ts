// Casting Call (WS9) e2e, desktop + 375px. Node computes today's pair and an optimal chain from
// the fixture library (the same deterministic inputs the keyless server uses); the browser never
// receives that path until the round is finished.
import type { Page, Response } from '@playwright/test';
import { APP_NAME, COPY } from '../../src/config/brand';
import fixture from '../../src/server/db/fixtures/library.json';
import type { LibrarySnapshot } from '../../src/server/db/repo';
import { dateInResetZone } from '../../src/lib/dates';
import { buildCastGraph, pickDailyPair, type ChainLink } from '../../src/server/modes/casting-call/graph';
import { test, expect } from './fixtures';

const lib = fixture as unknown as LibrarySnapshot;
const graph = buildCastGraph(lib.films, lib.people);

function todaysPair() {
  const pair = pickDailyPair(graph, dateInResetZone());
  if (!pair) throw new Error('fixture library has no casting call pair');
  return pair;
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

/** Record every casting-call API body so the test can assert nothing leaked before the finish. */
function recordApi(page: Page): string[] {
  const bodies: string[] = [];
  page.on('response', async (res: Response) => {
    if (!res.url().includes('/api/modes/casting-call')) return;
    try {
      bodies.push(await res.text());
    } catch {
      /* navigation raced the body read */
    }
  });
  return bodies;
}

async function open(page: Page) {
  await page.goto('/modes/casting-call');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/Casting/i);
  await expect(page.getByTestId('cc-film-picker').or(page.getByTestId('cc-result'))).toBeVisible();
}

async function playLinkByPointer(page: Page, link: ChainLink) {
  await page.getByTestId('cc-film-picker').locator(`[data-option-id="${link.filmId}"]`).click();
  const actor = page.getByTestId('cc-actor-picker').locator(`[data-option-id="${link.personId}"]`);
  await actor.click();
  await expect(page.locator(`[data-row="actor"][data-person-id="${link.personId}"]`).first()).toBeVisible();
}

async function playLinkByKeyboard(page: Page, link: ChainLink) {
  const filmTitle = graph.films.get(link.filmId)!.title;
  const personName = graph.people.get(link.personId)!.name;
  const filmInput = page.getByTestId('cc-film-picker').getByRole('combobox');
  await filmInput.focus();
  await page.keyboard.type(filmTitle);
  // Filtering leaves the film; arrow onto it (first enabled match) and press Enter.
  await expect(page.getByTestId('cc-film-picker').locator(`[data-option-id="${link.filmId}"]`)).toBeVisible();
  const options = page.getByTestId('cc-film-picker').getByRole('option');
  const ids = await options.evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-option-id'))));
  for (let i = 0; i <= ids.indexOf(link.filmId); i++) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  const actorInput = page.getByTestId('cc-actor-picker').getByRole('combobox');
  await expect(actorInput).toBeFocused();
  await page.keyboard.type(personName);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.locator(`[data-row="actor"][data-person-id="${link.personId}"]`).first()).toBeVisible();
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

test.describe('casting call', () => {
  test('win by following an optimal chain, then resume after reload', async ({ page }) => {
    const pair = todaysPair();
    const bodies = recordApi(page);
    await open(page);
    await expect(page.getByText(graph.people.get(pair.startId)!.name).first()).toBeVisible();
    await expect(page.getByText(graph.people.get(pair.endId)!.name).first()).toBeVisible();
    // The server-rendered first frame carries no optimal chain.
    expect((await page.content()).toLowerCase()).not.toContain('optimalpath');
    await expectNoHorizontalScroll(page);

    for (const [i, l] of pair.optimal.entries()) {
      await playLinkByPointer(page, l);
      if (i < pair.optimal.length - 1) {
        await expect(page.getByTestId('cc-links')).toHaveText(`Films ${i + 1} / 6`);
      }
    }
    // Nothing before the final move mentioned the optimum.
    const before = bodies.slice(0, -1);
    for (const b of before) expect(b.toLowerCase()).not.toContain('optimal');

    const result = page.getByTestId('cc-result');
    await expect(result).toHaveAttribute('data-status', 'won');
    await expect(page.getByTestId('cc-stamp')).toHaveText(new RegExp(COPY.winStamp));
    const n = pair.optimal.length;
    await expect(page.getByTestId('cc-optimal')).toContainText(`Optimal: ${plural(n, 'film')}`);
    await expect(page.getByTestId('cc-share-preview')).toContainText(`${APP_NAME} · Casting Call · `);
    await expect(page.getByTestId('cc-share-preview')).toContainText(`${plural(n, 'film')} (optimal ${n})`);
    await expect(page.getByTestId('cc-share-preview')).toContainText('/modes/casting-call');
    await expectNoHorizontalScroll(page);

    await page.reload();
    await expect(page.getByTestId('cc-result')).toHaveAttribute('data-status', 'won');
    await expect(page.getByTestId('cc-film-picker')).toHaveCount(0);
  });

  test('keyboard only: one link, then walk away reveals the optimal chain', async ({ page }) => {
    const pair = todaysPair();
    const bodies = recordApi(page);
    await open(page);
    // A legal first link that is not the end actor.
    const startFilms = graph.filmsByPerson.get(pair.startId)!;
    let first: ChainLink | null = null;
    for (const fid of startFilms) {
      const pid = graph.films.get(fid)!.cast.find((p) => p !== pair.startId && p !== pair.endId && graph.filmsByPerson.get(p)!.length > 1);
      if (pid) {
        first = { filmId: fid, personId: pid };
        break;
      }
    }
    expect(first).not.toBeNull();
    await playLinkByKeyboard(page, first!);
    await expect(page.getByTestId('cc-links')).toHaveText('Films 1 / 6');
    for (const b of bodies) expect(b.toLowerCase()).not.toContain('optimal');

    // Walk away with the keyboard: focus the button, Enter, then confirm.
    const walk = page.getByRole('button', { name: COPY.giveUp });
    await walk.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: COPY.giveUp }).focus();
    await page.keyboard.press('Enter');

    const result = page.getByTestId('cc-result');
    await expect(result).toHaveAttribute('data-status', 'lost');
    await expect(page.getByTestId('cc-stamp')).toHaveText(COPY.lossStamp);
    await expect(page.getByTestId('cc-optimal')).toContainText(`Optimal: ${plural(pair.optimal.length, 'film')}`);
    const optimalBoard = page.getByRole('list', { name: /An optimal chain/ });
    for (const l of pair.optimal) {
      await expect(optimalBoard.locator(`[data-row="film"][data-film-id="${l.filmId}"]`)).toBeVisible();
    }
    await expect(page.getByTestId('cc-share-preview')).toContainText(`No connection (optimal ${pair.optimal.length})`);
  });

  test('the server rejects a move outside the cast graph', async ({ page }) => {
    const pair = todaysPair();
    await open(page);
    const state = await (await page.request.get('/api/modes/casting-call')).json();
    const outsider = [...graph.films.values()].find((f) => !f.cast.includes(pair.startId))!;
    const res = await page.request.post('/api/modes/casting-call/link', {
      data: { date: state.date, filmId: outsider.id, personId: outsider.cast[0] },
    });
    expect(res.status()).toBe(400);
    const body = await res.text();
    expect(body.toLowerCase()).not.toContain('optimal');
  });
});
