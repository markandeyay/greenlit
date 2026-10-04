// Classic daily round flows (Sections 4.1, 4.8, 7.1; WS5 and WS6 acceptance), on desktop and 375px.
import type { Page } from '@playwright/test';
import { APP_NAME, COPY, shareHost } from '../../src/config/brand';
import { RULES } from '../../src/config/rules';
import { todayAnswer, todayNumber, wrongFilms } from './helpers/answer';
import { guessFilm, playWrong, searchInput, takeRows, takesLeftText, waitForBoard } from './helpers/game';
import { test, expect } from './fixtures';

const answer = todayAnswer();

async function openToday(page: Page) {
  await page.goto('/');
  await waitForBoard(page);
  await expect(searchInput(page)).toBeVisible();
}

function resultCard(page: Page) {
  return page.getByTestId('result-card');
}

const ROW = /^🎬 (?:🟩|🟨|⬛){8}$/u;
const WIN_ROW = /^🟢 🟩{8}$/u;

test.describe('daily round', () => {
  test('win: wrong takes then the answer shows the GREENLIT stamp, reveal card and share sheet', async ({ page }) => {
    await openToday(page);
    const wrong = wrongFilms(answer, 3);
    await playWrong(page, wrong);
    await expect(page.getByText(takesLeftText(3))).toBeVisible();
    await guessFilm(page, answer);

    const card = resultCard(page);
    await expect(card.getByText(COPY.winStamp, { exact: true })).toBeVisible();
    await expect(card.getByRole('heading', { level: 2 }).first()).toContainText('Got the green light in 4 takes');
    await expect(card.getByText('You found')).toBeVisible();
    await expect(card.getByText(answer.title, { exact: true }).first()).toBeVisible();
    await expect(card.getByText(String(answer.releaseYear)).first()).toBeVisible();
    await expect(page.locator('[data-share-sheet]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Share', exact: true })).toBeVisible();
    // The search is gone: the round is over.
    await expect(searchInput(page)).toHaveCount(0);
    await expect(takeRows(page)).toHaveCount(4);
  });

  test('loss: ten wrong takes sends the reel to turnaround', async ({ page }) => {
    test.setTimeout(150_000);
    await openToday(page);
    await playWrong(page, wrongFilms(answer, RULES.maxGuesses));
    const card = resultCard(page);
    await expect(card.getByText(COPY.lossStamp, { exact: true })).toBeVisible();
    await expect(card.getByText(`Out of takes after ${RULES.maxGuesses}`)).toBeVisible();
    await expect(card.getByText('The film was')).toBeVisible();
    await expect(card.getByText(answer.title, { exact: true }).first()).toBeVisible();
    await expect(page.getByTestId('share-preview')).toContainText(`🔴 ${COPY.lossStamp}`);
    await expect(page.getByTestId('share-preview')).toContainText(`Take X/${RULES.maxGuesses}`);
  });

  test('give up: Walk away asks for confirmation, Keep rolling cancels, confirming ends the round', async ({ page }) => {
    await openToday(page);
    await playWrong(page, wrongFilms(answer, 2));

    await page.getByRole('button', { name: COPY.giveUp }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Walk away from this reel?' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Keep rolling' })).toBeFocused();
    await dialog.getByRole('button', { name: 'Keep rolling' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(searchInput(page)).toBeVisible();

    await page.getByRole('button', { name: COPY.giveUp }).click();
    const giveup = page.waitForResponse((r) => r.url().includes('/api/giveup'));
    await page.getByRole('alertdialog').getByRole('button', { name: COPY.giveUp }).click();
    expect((await giveup).status()).toBe(200);

    const card = resultCard(page);
    await expect(card.getByText(COPY.lossStamp, { exact: true })).toBeVisible();
    await expect(card.getByText('Walked away after 2 takes')).toBeVisible();
    await expect(card.getByText(answer.title, { exact: true }).first()).toBeVisible();
  });

  test('hints: Note 1 unlocks after the first threshold, Note 2 after the second', async ({ page }) => {
    test.setTimeout(150_000);
    const [first, second] = RULES.hintUnlockAfter;
    await openToday(page);
    const notes = page.locator('section').filter({ has: page.getByRole('heading', { name: COPY.hintsName }) });
    // Before the first unlock the notes are one quiet chip naming the next unlock take.
    await expect(notes.getByText(`Unlocks after take ${first}`)).toBeVisible();
    await expect(notes.getByRole('radio')).toHaveCount(0);

    const wrong = wrongFilms(answer, second);
    await playWrong(page, wrong.slice(0, first - 1));
    await expect(notes.getByRole('radio')).toHaveCount(0);
    await guessFilm(page, wrong[first - 1]!);

    // Note 1: pick a type by label without seeing it, then reveal.
    const note1 = notes.locator('fieldset').filter({ hasText: 'Note 1' });
    await expect(note1.getByRole('radio').first()).toBeVisible();
    await note1.locator('label.gm-note-choice').first().click();
    await expect(note1.getByRole('radio').first()).toBeChecked();
    const hint1 = page.waitForResponse((r) => r.url().endsWith('/api/hint') && r.request().method() === 'POST');
    await note1.getByRole('button', { name: 'Reveal note 1' }).click();
    expect((await hint1).status()).toBe(200);
    await expect(notes.locator('.gm-note-page')).toHaveCount(1);
    await expect(notes.locator('.gm-note-page').first()).not.toBeEmpty();
    await expect(notes.getByText('1 / 2 used')).toBeVisible();
    await expect(notes.getByText(`Unlocks after take ${second}`).first()).toBeVisible();

    await playWrong(page, wrong.slice(first, second));
    const note2 = notes.locator('fieldset').filter({ hasText: 'Note 2' });
    await expect(note2.getByRole('radio').first()).toBeVisible();
    await note2.locator('label.gm-note-choice').first().click();
    await note2.getByRole('button', { name: 'Reveal note 2' }).click();
    await expect(notes.locator('.gm-note-page')).toHaveCount(2);
    await expect(notes.getByText('2 / 2 used')).toBeVisible();
    // Neither note gives the title away.
    await expect(notes).not.toContainText(answer.title);

    // Notes flag the share with a 📝.
    await guessFilm(page, answer);
    await expect(page.getByTestId('share-preview')).toContainText(`Take ${second + 1}/${RULES.maxGuesses} 📝`);
  });

  test('How to play: the help button opens the quick rules sheet with the legend; Escape closes it', async ({ page }) => {
    await openToday(page);
    await page.getByRole('button', { name: 'How to play' }).first().click();
    const sheet = page.getByRole('dialog', { name: 'How to play' });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('group', { name: 'Example guess' }).locator('[role="img"]')).toHaveCount(3);
    await expect(sheet).toContainText('✓');
    await expect(sheet).toContainText('≈');
    await expect(sheet).toContainText('LATER');
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await expect(searchInput(page)).toBeVisible();
  });

  test('hint API refuses a note before the unlock threshold', async ({ page }) => {
    await openToday(page);
    const res = await page.request.post('/api/hint', {
      data: { kind: 'daily', ref: String(todayNumber()), slot: 1, hintType: 'tagline' },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
    const body = (await res.json()) as { error?: { code: string } };
    expect(body.error?.code).toBeTruthy();
  });

  test('resume: reload mid-round restores rows and take count; a finished round stays finished', async ({ page }) => {
    await openToday(page);
    const wrong = wrongFilms(answer, 3);
    await playWrong(page, wrong);
    await page.reload();
    await waitForBoard(page);
    await expect(takeRows(page)).toHaveCount(3);
    await expect(page.getByText(takesLeftText(3))).toBeVisible();
    for (const f of wrong) await expect(page.getByRole('heading', { level: 3, name: new RegExp(f.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) })).toBeVisible();
    await expect(searchInput(page)).toBeVisible();

    await guessFilm(page, answer);
    await expect(resultCard(page).getByText(COPY.winStamp, { exact: true })).toBeVisible();
    await page.reload();
    await waitForBoard(page);
    await expect(resultCard(page).getByText(COPY.winStamp, { exact: true })).toBeVisible();
    await expect(searchInput(page)).toHaveCount(0);
    await expect(takeRows(page)).toHaveCount(4);

    // The server agrees: another guess is refused.
    const again = await page.request.post('/api/guess', {
      data: { kind: 'daily', ref: String(todayNumber()), filmId: wrongFilms(answer, 4)[3]!.id },
    });
    expect(again.status()).toBeGreaterThanOrEqual(400);
  });

  test('share text: Copy text puts the Section 7.1 format on the clipboard, with no title', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openToday(page);
    await playWrong(page, wrongFilms(answer, 3));
    await guessFilm(page, answer);

    await page.getByRole('button', { name: 'Copy text' }).click();
    await expect(page.getByText('Copied')).toBeVisible();
    // The Windows clipboard stores CRLF line endings; normalize before comparing.
    const copied = (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n');
    const preview = (await page.getByTestId('share-preview').textContent()) ?? '';
    expect(copied).toBe(preview);

    const lines = copied.split('\n');
    expect(lines[0]).toBe(`${APP_NAME} · Reel ${todayNumber()} · Take 4/${RULES.maxGuesses}`);
    expect(lines.slice(1, 4).every((l) => ROW.test(l))).toBe(true);
    expect(lines[4]).toMatch(WIN_ROW);
    expect(lines[5]).toBe(`${shareHost()}/${todayNumber()}`);
    expect(lines).toHaveLength(6);
    expect(copied.toLowerCase()).not.toContain(answer.title.toLowerCase());
  });
});
