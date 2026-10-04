// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResultCard, resultHeadline } from '@/components/game/ResultCard';
import { COPY } from '@/config/brand';
import { RULES } from '@/config/rules';
import type { DailyStatsResponse, Reveal } from '@/lib/types';
import { fb } from './fixtures';

const shareProps = vi.fn();
vi.mock('@/components/share', () => ({
  ShareSheet: (p: Record<string, unknown>) => {
    shareProps(p);
    return <div data-testid="share" />;
  },
}));

afterEach(cleanup);

const reveal: Reveal = {
  filmId: 9,
  title: 'Heat',
  year: 1995,
  posterPath: null,
  director: 'Michael Mann',
  tagline: 'A Los Angeles crime saga',
  trailerYoutube: 'abcDEF12345',
};

const stats = (distribution: number[]): DailyStatsResponse => ({
  puzzleNumber: 4,
  distribution,
  plays: distribution.reduce((a, b) => a + b, 0),
  wins: distribution.slice(0, RULES.maxGuesses).reduce((a, b) => a + b, 0),
});

describe('ResultCard', () => {
  it('headlines', () => {
    expect(resultHeadline('won', 4)).toBe('Got the green light in 4 takes.');
    expect(resultHeadline('won', 1)).toBe('In one take. Unheard of.');
    expect(resultHeadline('lost', RULES.maxGuesses)).toContain('Out of takes');
    expect(resultHeadline('lost', 3)).toBe('Walked away after 3 takes.');
  });

  it('shows the win stamp, reveal, trailer facade, stats and share', async () => {
    const loadStats = vi.fn(async () => stats([0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 2]));
    const feedback = [fb({ filmId: 1 }), fb({ filmId: 2 }), fb({ filmId: 9, isCorrect: true })];
    render(
      <ResultCard kind="daily" gameRef="4" reelNumber={4} status="won" feedback={feedback} hintsUsed={1} reveal={reveal} loadStats={loadStats} />,
    );
    expect(screen.getByText(COPY.winStamp, { selector: '.gm-stamp' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(`${COPY.winStamp}. Got the green light in 3 takes.`);
    expect(screen.getByText('Heat', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText('Michael Mann')).toBeInTheDocument();
    expect(screen.getByText(/1 script note used/)).toBeInTheDocument();
    // 6 plays incl. self in bucket 2 (3 takes); others = 5; worse = 1 + 2 losses => 60%.
    expect(await screen.findByText('You beat 60% of players today.')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'How everyone did today' }).children).toHaveLength(RULES.maxGuesses + 1);
    expect(screen.getByRole('listitem', { name: /Won in 3 takes: 2 players, 33%, your result/ })).toBeInTheDocument();
    expect(shareProps).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'daily', ref: '4', reelNumber: 4, status: 'won', hintsUsed: 1, feedback }),
    );
    expect(screen.getByText('Post your take')).toBeInTheDocument();
    expect(document.querySelector('iframe')).toBeNull();
    await userEvent.setup().click(screen.getByRole('button', { name: /Roll the trailer/ }));
    expect(document.querySelector('iframe')?.getAttribute('src')).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\/abcDEF12345/);
  });

  it('handles zero other players gracefully', async () => {
    render(
      <ResultCard kind="daily" gameRef="4" reelNumber={4} status="won" feedback={[fb({ isCorrect: true })]} hintsUsed={0} reveal={reveal} loadStats={async () => stats(Array(11).fill(0))} />,
    );
    expect(await screen.findByText(/first one on set/)).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'How everyone did today' })).toBeNull();
  });

  it('shows the loss stamp, no stats for the vault, and the no credit note', async () => {
    const loadStats = vi.fn();
    render(
      <ResultCard kind="vault" gameRef="2" reelNumber={2} status="lost" feedback={[fb()]} hintsUsed={0} reveal={{ ...reveal, trailerYoutube: null }} loadStats={loadStats} />,
    );
    expect(screen.getByText(COPY.lossStamp, { selector: '.gm-stamp' })).toBeInTheDocument();
    expect(screen.getByText(/no leaderboard credit/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Roll the trailer/ })).toBeNull();
    await waitFor(() => expect(loadStats).not.toHaveBeenCalled());
  });
});
