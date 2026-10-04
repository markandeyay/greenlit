// Page helpers for driving a round through the real UI.
import { expect, type Locator, type Page } from '@playwright/test';
import { RULES } from '../../../src/config/rules';
import type { Film } from '../../../src/lib/types';

export function searchInput(page: Page): Locator {
  return page.getByRole('combobox', { name: /Name a film/i });
}

/** Wait until the board has loaded the play (search visible or the result card shown). */
export async function waitForBoard(page: Page): Promise<void> {
  await expect(page.getByText('Loading the reel')).toHaveCount(0, { timeout: 20_000 });
}

export function takeRows(page: Page): Locator {
  return page.locator('article[data-take]');
}

/** Type a title and pick the exact film (title + year) from the listbox with the mouse. */
export async function guessFilm(page: Page, film: Film): Promise<void> {
  const before = await takeRows(page).count();
  const input = searchInput(page);
  await input.click();
  await input.fill(film.title);
  const option = page
    .getByRole('option')
    .filter({ hasText: film.title })
    .filter({ hasText: String(film.releaseYear) })
    .first();
  await expect(option).toBeVisible();
  const res = page.waitForResponse((r) => r.url().includes('/api/guess') && r.request().method() === 'POST');
  await option.click();
  expect((await res).status()).toBe(200);
  await expect(takeRows(page)).toHaveCount(before + 1);
}

/** Keyboard-only guess: type, then ArrowDown until the active option is the film, then Enter. */
export async function guessFilmByKeyboard(page: Page, film: Film): Promise<void> {
  const before = await takeRows(page).count();
  await page.keyboard.type(film.title, { delay: 10 });
  const input = searchInput(page);
  await expect(input).toHaveAttribute('aria-expanded', 'true');
  for (let i = 0; i < 12; i++) {
    const activeId = await input.getAttribute('aria-activedescendant');
    if (activeId) {
      const text = (await page.locator(`[id="${activeId}"]`).textContent()) ?? '';
      if (text.includes(film.title) && text.includes(String(film.releaseYear))) break;
    }
    await page.keyboard.press('ArrowDown');
  }
  await page.keyboard.press('Enter');
  await expect(takeRows(page)).toHaveCount(before + 1);
}

export async function playWrong(page: Page, films: Film[]): Promise<void> {
  for (const f of films) await guessFilm(page, f);
}

export function takesLeftText(take: number): RegExp {
  const left = RULES.maxGuesses - take;
  return new RegExp(`^${left} ${left === 1 ? 'take' : 'takes'} left$`);
}
