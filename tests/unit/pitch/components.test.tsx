// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilmPicker, rankFilms } from '@/components/pitch/FilmPicker';
import { PitchStudio, noteLength } from '@/components/pitch/PitchStudio';
import { PitchResults, resultLabel } from '@/components/pitch/PitchResults';
import { pitchShareText } from '@/components/pitch/ShareLink';
import { readRecentPitches, saveRecentPitch, RECENT_PITCHES_KEY, RECENT_PITCHES_MAX } from '@/components/pitch/recent-pitches';
import { COPY } from '@/config/brand';
import { PITCH, SEARCH } from '@/config/game';
import type { SearchIndexEntry, SearchResult } from '@/lib/types';
import { useState } from 'react';

const FILMS: SearchIndexEntry[] = [
  { id: 1, title: 'The Silver Harbor', year: 1994, posterPath: null },
  { id: 2, title: 'Silverado', year: 1985, posterPath: '/p.jpg' },
  { id: 3, title: 'Paper Moons', year: 2001, posterPath: null },
];

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('pure helpers', () => {
  it('rankFilms needs the minimum query length and ranks title matches', () => {
    expect(rankFilms(FILMS, 's'.repeat(SEARCH.minQueryLength - 1))).toEqual([]);
    expect(rankFilms(FILMS, 'silver').map((f) => f.id)).toEqual([2, 1]);
    expect(rankFilms(FILMS, 'paper moons')[0]).toEqual({ id: 3, title: 'Paper Moons', year: 2001, posterPath: null });
  });

  it('noteLength counts like the server (collapsed, trimmed, code points)', () => {
    expect(noteLength('  a   b  ')).toBe(3);
    expect(noteLength('🎬🎬')).toBe(2);
  });

  it('share text never names a film and result labels carry words, not just color', () => {
    expect(pitchShareText()).not.toMatch(/Harbor/);
    expect(resultLabel({ handle: null, status: 'won', takes: 3, hintsUsed: 0, finishedAt: null }).text).toBe(COPY.winStamp);
    expect(resultLabel({ handle: null, status: 'lost', takes: 10, hintsUsed: 0, finishedAt: null }).text).toBe(COPY.lossStamp);
  });

  it('recent pitches persist newest first, deduplicated and capped', () => {
    const mk = (i: number) => ({ slug: `s${i}`, url: `u${i}`, film: FILMS[0]!, note: null, createdAt: 'x' });
    for (let i = 0; i < RECENT_PITCHES_MAX + 3; i++) saveRecentPitch(mk(i));
    saveRecentPitch(mk(5));
    const list = readRecentPitches();
    expect(list).toHaveLength(RECENT_PITCHES_MAX);
    expect(list[0]!.slug).toBe('s5');
    expect(new Set(list.map((p) => p.slug)).size).toBe(list.length);
    localStorage.setItem(RECENT_PITCHES_KEY, '{broken');
    expect(readRecentPitches()).toEqual([]);
  });
});

function PickerHarness({ onPick }: { onPick: (f: SearchResult | null) => void }) {
  const [v, setV] = useState<SearchResult | null>(null);
  return (
    <FilmPicker
      value={v}
      onChange={(f) => {
        setV(f);
        onPick(f);
      }}
      search={async (q) => rankFilms(FILMS, q)}
    />
  );
}

describe('FilmPicker', () => {
  it('is a keyboard operable combobox', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<PickerHarness onPick={onPick} />);
    const box = screen.getByRole('combobox', { name: 'Film' });
    await user.type(box, 'silver');
    const options = await screen.findAllByRole('option');
    expect(options).toHaveLength(2);
    expect(box).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onPick).toHaveBeenCalledWith({ id: 1, title: 'The Silver Harbor', year: 1994, posterPath: null });
    expect(screen.getByText('The Silver Harbor')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Change' }));
    expect(screen.getByRole('combobox')).toHaveValue('');
  });
});

describe('PitchStudio', () => {
  it('creates a pitch, shows the share link, and saves it locally', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/search-index.json') return new Response(JSON.stringify({ v: 1, films: FILMS }));
      if (url === '/api/pitch') {
        const body = JSON.parse(String(init?.body)) as { filmId: number; note?: string };
        expect(body).toEqual({ filmId: 3, note: 'Origami everywhere' });
        return new Response(JSON.stringify({ slug: 'abcd1234', url: 'http://localhost:3000/p/abcd1234' }), { status: 201 });
      }
      if (url.startsWith('/api/pitch/abcd1234/results')) return new Response(JSON.stringify({ error: { code: 'forbidden', message: 'x' } }), { status: 403 });
      throw new Error(`unexpected ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<PitchStudio />);
    const create = screen.getByRole('button', { name: /create challenge/i });
    expect(create).toBeDisabled();
    await user.type(screen.getByRole('combobox'), 'paper');
    await user.click(await screen.findByRole('option', { name: /Paper Moons/ }));
    const note = screen.getByLabelText(/note/i);
    await user.type(note, 'Origami everywhere');
    expect(screen.getByText(`18 / ${PITCH.noteMaxLength}`)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /create challenge/i }));
    expect(await screen.findByDisplayValue('http://localhost:3000/p/abcd1234')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeInTheDocument();
    expect(readRecentPitches()[0]).toMatchObject({ slug: 'abcd1234', film: { id: 3 } });
    await user.click(screen.getByRole('button', { name: 'See how friends did' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/device \(or account\)/);
  });

  it('blocks notes over the limit', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ v: 1, films: FILMS }))));
    const user = userEvent.setup();
    render(<PitchStudio />);
    const note = screen.getByLabelText(/note/i);
    await user.click(note);
    await user.paste('z'.repeat(PITCH.noteMaxLength + 2));
    expect(screen.getByText(/2 over/)).toBeInTheDocument();
    expect(note).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('PitchResults', () => {
  it('renders the creator view with words for each result', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            slug: 'abcd1234',
            film: { filmId: 3, title: 'Paper Moons', year: 2001, posterPath: null, director: 'Other', tagline: null, trailerYoutube: null },
            results: [
              { handle: 'reelfan', status: 'won', takes: 3, hintsUsed: 1, finishedAt: '2026-10-04T16:00:00.000Z' },
              { handle: null, status: 'in_progress', takes: 2, hintsUsed: 0, finishedAt: null },
            ],
          }),
        ),
      ),
    );
    render(<PitchResults slug="abcd1234" />);
    expect(await screen.findByText('Paper Moons')).toBeInTheDocument();
    expect(screen.getByText('reelfan')).toBeInTheDocument();
    expect(screen.getByText('Anonymous player')).toBeInTheDocument();
    expect(screen.getByText(COPY.winStamp)).toBeInTheDocument();
    expect(screen.getByText('Still shooting')).toBeInTheDocument();
    await waitFor(() => expect(document.body.textContent).toMatch(/1 greenlit · 0 sent to turnaround · 1 still shooting/));
  });
});
