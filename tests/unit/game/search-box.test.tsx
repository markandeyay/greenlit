// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchBox } from '@/components/game/SearchBox';
import type { SearchResult } from '@/lib/types';

afterEach(cleanup);

const FILMS: SearchResult[] = [
  { id: 1, title: 'Alien', year: 1979, posterPath: null },
  { id: 2, title: 'Aliens', year: 1986, posterPath: null },
  { id: 3, title: 'Alien 3', year: 1992, posterPath: null },
];
const search = vi.fn(async (q: string) => FILMS.filter((f) => f.title.toLowerCase().includes(q.toLowerCase())));

function setup(guessed: number[] = [], busy = false) {
  const onSelect = vi.fn();
  render(
    <SearchBox label="Take 01 · Name a film" onSelect={onSelect} guessedIds={new Set(guessed)} busy={busy} search={search} />,
  );
  const input = screen.getByRole('combobox', { name: /Name a film/ });
  return { onSelect, input, user: userEvent.setup() };
}

describe('SearchBox', () => {
  it('is a labelled ARIA combobox that opens a listbox', async () => {
    const { input, user } = setup();
    expect(input).toHaveAttribute('aria-expanded', 'false');
    await user.type(input, 'ali');
    await waitFor(() => expect(input).toHaveAttribute('aria-expanded', 'true'));
    const list = screen.getByRole('listbox');
    expect(input).toHaveAttribute('aria-controls', list.id);
    expect(screen.getAllByRole('option')).toHaveLength(3);
    expect(input.getAttribute('aria-activedescendant')).toBe(screen.getAllByRole('option')[0]!.id);
  });

  it('moves with arrows and submits with Enter', async () => {
    const { input, user, onSelect } = setup();
    await user.type(input, 'ali');
    await screen.findAllByRole('option');
    await user.keyboard('{ArrowDown}');
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowUp}');
    expect(screen.getAllByRole('option')[2]).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith(FILMS[2]);
    expect(input).toHaveValue('');
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows already-guessed titles as disabled and skips them', async () => {
    const { input, user, onSelect } = setup([1]);
    await user.type(input, 'ali');
    const opts = await screen.findAllByRole('option');
    expect(opts[0]).toHaveAttribute('aria-disabled', 'true');
    expect(opts[0]).toHaveTextContent('Already shot');
    expect(opts[1]).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowUp}');
    expect(opts[2]).toHaveAttribute('aria-selected', 'true');
    await user.click(opts[0]!);
    expect(onSelect).not.toHaveBeenCalled();
    await user.click(opts[1]!);
    expect(onSelect).toHaveBeenCalledWith(FILMS[1]);
  });

  it('Escape closes the list, then clears the query', async () => {
    const { input, user } = setup();
    await user.type(input, 'ali');
    await screen.findAllByRole('option');
    await user.keyboard('{Escape}');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).toHaveValue('ali');
    await user.keyboard('{Escape}');
    expect(input).toHaveValue('');
  });

  it('is read-only while a take is in flight', async () => {
    const { input, user, onSelect } = setup([], true);
    expect(input).toHaveAttribute('readonly');
    expect(input).toHaveAttribute('aria-busy', 'true');
    await user.type(input, 'ali{Enter}');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('tells the player when nothing matches', async () => {
    const { input, user } = setup();
    await user.type(input, 'zzzz');
    await waitFor(() =>
      expect(screen.getAllByRole('status').some((el) => /No film by that title/.test(el.textContent ?? ''))).toBe(true),
    );
  });
});
