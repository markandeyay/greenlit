// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';

import userEvent from '@testing-library/user-event';
import { CallSheet, CallSheetStrip, RangeBar } from '@/components/callsheet';
import { COPY } from '@/config/brand';
import { film, simulateFeedback } from './helpers';

afterEach(cleanup);

const answer = film({
  id: 1,
  year: 2009,
  boxOffice: 800_000_000,
  score: 82,
  directorIds: [7],
  directorDisplay: 'Christopher Nolan',
  leadId: 100,
  supportingIds: [101],
  studio: 'Warner Bros.',
  rating: 'PG-13',
  genres: [1, 2, 3],
});

const feedback = [
  simulateFeedback(answer, film({ id: 2, year: 2004, boxOffice: 210_000_000, directorIds: [9], directorDisplay: 'Someone Else', leadId: 500, supportingIds: [101], studio: 'Universal', rating: 'R', genres: [1, 9] })),
  simulateFeedback(answer, film({ id: 3, year: 2014, boxOffice: 3_400_000_000, directorIds: [7], directorDisplay: 'Christopher Nolan', leadId: 501, studio: 'A24', rating: 'PG-13', genres: [10] })),
];

describe('CallSheet', () => {
  it('renders the header, rows, CONFIRMED and CUT', () => {
    render(<CallSheet feedback={feedback} reelNumber={212} take={2} maxGuesses={10} />);
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).toHaveTextContent(COPY.callSheet);
    expect(heading).toHaveTextContent('Reel No. 212');
    expect(heading).toHaveTextContent('TAKE 2 / 10');
    const table = screen.getByRole('table');
    for (const label of ['Director', 'Year', 'Box office', 'Score', 'Rating', 'Studio', 'Genres']) {
      expect(within(table).getByRole('rowheader', { name: label })).toBeInTheDocument();
    }
    expect(screen.getByText('Christopher Nolan')).toBeInTheDocument();
    expect(screen.getAllByText(COPY.confirmed).length).toBeGreaterThan(0);
    expect(screen.getAllByText(COPY.ruledOut).length).toBeGreaterThan(0);
    expect(screen.getByText('Person 500').closest('s')).not.toBeNull();
    expect(screen.getByText('2008 to 2010')).toBeInTheDocument();
    expect(screen.getByText('$420M to $1.7B')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Year between 2008 and 2010' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Box office between $420M and $1.7B' })).toBeInTheDocument();
    expect(screen.getByText('not Universal, not A24')).toBeInTheDocument();
    expect(screen.getByText(/3 genres total/)).toBeInTheDocument();
    expect(screen.getByText(/ruled out: Genre 9, Genre 10/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/—/);
  });

  it('shows the empty state before any guess', () => {
    render(<CallSheet feedback={[]} reelNumber={1} take={0} maxGuesses={10} />);
    expect(screen.getByText('INT. THE CALL SHEET - NIGHT')).toBeInTheDocument();
    expect(screen.getAllByText('TBD').length).toBeGreaterThan(5);
  });

  it('row buttons report guess indices and toggle off', async () => {
    const user = userEvent.setup();
    const onRowSelect = vi.fn();
    const { rerender } = render(
      <CallSheet feedback={feedback} reelNumber={212} take={2} maxGuesses={10} onRowSelect={onRowSelect} />,
    );
    const director = screen.getByRole('button', { name: /^Director/ });
    expect(director).toHaveAttribute('aria-pressed', 'false');
    director.focus();
    await user.keyboard('{Enter}');
    expect(onRowSelect).toHaveBeenLastCalledWith([0, 1], 'director');

    rerender(
      <CallSheet feedback={feedback} reelNumber={212} take={2} maxGuesses={10} onRowSelect={onRowSelect} highlighted="director" />,
    );
    const pressed = screen.getByRole('button', { name: /^Director/ });
    expect(pressed).toHaveAttribute('aria-pressed', 'true');
    await user.click(pressed);
    expect(onRowSelect).toHaveBeenLastCalledWith([], null);
  });

  it('shows a region tag only when the rating region differs from the player region', () => {
    const fb = [simulateFeedback(answer, answer, 'US')];
    const { rerender } = render(<CallSheet feedback={fb} reelNumber={3} take={1} maxGuesses={10} playerRegion="GB" />);
    expect(screen.getByText('US')).toBeInTheDocument();
    rerender(<CallSheet feedback={fb} reelNumber={3} take={1} maxGuesses={10} playerRegion="US" />);
    expect(screen.queryByText('US')).toBeNull();
  });
});

describe('CallSheetStrip', () => {
  it('toggles by keyboard, manages focus, Escape collapses', async () => {
    const user = userEvent.setup();
    render(<CallSheetStrip feedback={feedback} reelNumber={212} take={2} maxGuesses={10} />);
    const button = screen.getByRole('button', { name: /CALL SHEET.*\d+ confirmed/ });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    const panelId = button.getAttribute('aria-controls')!;
    const panel = document.getElementById(panelId)!;
    expect(panel).not.toBeVisible();

    await user.tab();
    expect(button).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(panel).toBeVisible();
    expect(panel).toHaveFocus();
    expect(within(panel).getByRole('table')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveFocus();

    await user.keyboard(' ');
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });

  it('counts confirmed facts in the strip label', () => {
    render(<CallSheetStrip feedback={feedback} reelNumber={212} take={2} maxGuesses={10} />);
    // director + Person 101 + rating + genre 1
    expect(screen.getByRole('button', { name: /4 confirmed/ })).toBeInTheDocument();
  });
});

describe('RangeBar', () => {
  it('exposes a text alternative and emphasizes the last tick', () => {
    render(
      <RangeBar
        label="Year between 2007 and 2011"
        domain={[2000, 2020]}
        lo={2007}
        hi={2011}
        ticks={[{ value: 2003 }, { value: 2014, emphasized: true }]}
      />,
    );
    expect(screen.getByRole('img', { name: 'Year between 2007 and 2011' })).toBeInTheDocument();
    expect(screen.getAllByTestId('rangebar-tick')).toHaveLength(1);
    expect(screen.getByTestId('rangebar-tick-last')).toBeInTheDocument();
    const range = screen.getByTestId('rangebar-range');
    expect(range.style.left).toBe('35%');
    expect(range.style.width).toBe('20%');
  });
});
