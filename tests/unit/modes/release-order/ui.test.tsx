// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { APP_NAME, shareHost } from '@/config/brand';
import { ToastProvider } from '@/components/ui';
import { buildReleaseOrderShare, moveKey, ReleaseOrderGame, SortBoard } from '@/components/modes/release-order';
import fixtureLibrary from '@/server/db/fixtures/library.json';
import { pickDailySet } from '@/server/modes/release-order/logic';
import type { Film } from '@/lib/types';
import type { ReleaseOrderCard, ReleaseOrderState } from '@/server/modes/release-order/types';
import { addDays } from '@/lib/dates';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const cards: ReleaseOrderCard[] = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'].map((title, key) => ({ key, title, posterPath: null }));

function Harness({ initial = [0, 1, 2, 3, 4] }: { initial?: number[] }) {
  const [order, setOrder] = useState(initial);
  return <SortBoard cards={cards} order={order} onChange={setOrder} lastAttempt={null} />;
}

const titles = () => screen.getAllByTestId('ro-title').map((el) => el.textContent?.replace(/^Position \d: /, ''));

describe('SortBoard', () => {
  it('moves films with the up and down buttons, keeps focus, and announces', async () => {
    render(<Harness />);
    const down = screen.getByRole('button', { name: 'Move Alpha down' });
    down.focus();
    fireEvent.click(down);
    expect(titles()).toEqual(['Bravo', 'Alpha', 'Charlie', 'Delta', 'Echo']);
    expect(screen.getByTestId('ro-announce')).toHaveTextContent('Alpha moved to position 2 of 5.');
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Move Alpha down' })));
    fireEvent.click(screen.getByRole('button', { name: 'Move Echo up' }));
    expect(titles()).toEqual(['Bravo', 'Alpha', 'Charlie', 'Echo', 'Delta']);
  });

  it('disables moves past the ends', () => {
    render(<Harness />);
    expect(screen.getByRole('button', { name: 'Move Alpha up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move Echo down' })).toBeDisabled();
  });

  it('moveKey inserts at a clamped index', () => {
    expect(moveKey([0, 1, 2, 3, 4], 0, 4)).toEqual([1, 2, 3, 4, 0]);
    expect(moveKey([0, 1, 2, 3, 4], 4, -3)).toEqual([4, 0, 1, 2, 3]);
  });
});

describe('share text', () => {
  const base: Pick<ReleaseOrderState, 'dateLabel' | 'maxAttempts'> = { dateLabel: 'Oct 4', maxAttempts: 3 };
  it('matches the spec for a win', () => {
    const text = buildReleaseOrderShare({
      ...base,
      status: 'won',
      attempts: [
        { order: [1, 0, 2, 4, 3], feedback: ['close', 'close', 'match', 'miss', 'close'] },
        { order: [0, 1, 2, 3, 4], feedback: ['match', 'match', 'match', 'match', 'match'] },
      ],
    });
    expect(text).toBe(`${APP_NAME} · Release Order · Oct 4 · 2/3\n🟨🟨🟩⬛🟨\n🟩🟩🟩🟩🟩\n${shareHost()}/modes/release-order`);
    expect(text).not.toContain('—');
  });
  it('reads X for a loss and never includes titles', () => {
    const attempts = Array.from({ length: 3 }, () => ({ order: [4, 3, 2, 1, 0], feedback: ['miss', 'close', 'match', 'close', 'miss'] as const }));
    const text = buildReleaseOrderShare({ ...base, status: 'lost', attempts: attempts.map((a) => ({ ...a, feedback: [...a.feedback] })) });
    expect(text.split('\n')[0]).toBe(`${APP_NAME} · Release Order · Oct 4 · X/3`);
    expect(text.split('\n')).toHaveLength(5);
    expect(text).not.toMatch(/Alpha|Bravo/);
  });
});

describe('ReleaseOrderGame', () => {
  const inProgress: ReleaseOrderState = {
    date: '2026-10-04',
    dateLabel: 'Oct 4',
    cards,
    attempts: [],
    maxAttempts: 3,
    status: 'in_progress',
    nextResetAt: '2026-10-05T04:00:00.000Z',
  };

  it('loads the set, submits the current order, and shows the reveal when finished', async () => {
    const won: ReleaseOrderState = {
      ...inProgress,
      status: 'won',
      attempts: [{ order: [0, 1, 2, 3, 4], feedback: ['match', 'match', 'match', 'match', 'match'] }],
      reveal: cards.map((c, i) => ({ ...c, releaseDate: `19${70 + i}-05-0${i + 1}`, releaseYear: 1970 + i })),
    };
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(inProgress), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(won), { status: 200 }));
    render(
      <ToastProvider>
        <ReleaseOrderGame />
      </ToastProvider>,
    );
    expect(await screen.findAllByTestId('ro-item')).toHaveLength(5);
    expect(screen.queryByTestId('ro-reveal')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Lock this order' }));
    const reveal = await screen.findByTestId('ro-reveal');
    expect(within(reveal).getAllByTestId('ro-reveal-date')[0]).toHaveTextContent('May 1, 1970');
    const body = JSON.parse(String(fetchMock.mock.calls[1]![1]!.body));
    expect(body).toEqual({ date: '2026-10-04', order: [0, 1, 2, 3, 4] });
    expect(screen.getByTestId('ro-share-preview').textContent).toContain('1/3');
  });
});

describe('fixture library', () => {
  it('always yields a valid daily set for a year of dates', () => {
    const films = (fixtureLibrary as { films: Film[] }).films;
    for (let d = 0; d < 365; d++) expect(pickDailySet(films, addDays('2026-10-01', d))).not.toBeNull();
  });
});
