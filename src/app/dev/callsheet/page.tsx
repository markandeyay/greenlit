'use client';

// Dev-only visual review page for the Call Sheet (WS3). Sample feedback is hand-written
// verdicts (no answer object anywhere), exactly like what the client receives from the server.

import { useState } from 'react';
import { CallSheet, CallSheetStrip, RangeBar, type CallSheetRowId } from '@/components/callsheet';
import { RULES } from '@/config/rules';
import type { GuessFeedback, NumberFeedback, PersonFeedback } from '@/lib/types';

const num = (value: number | null, verdict: NumberFeedback['verdict'], direction: NumberFeedback['direction'] = null): NumberFeedback => ({
  value,
  verdict,
  direction,
});
const person = (personId: number, name: string, match = false, answerRole?: 'lead' | 'supp'): PersonFeedback => ({
  personId,
  name,
  profilePath: null,
  verdict: match ? 'match' : 'miss',
  ...(answerRole ? { answerRole } : {}),
});
const genre = (id: number, name: string, match = false) => ({ id, name, verdict: match ? ('match' as const) : ('miss' as const) });

interface Sample {
  title: string;
  director: [string, number[], boolean];
  lead: PersonFeedback | null;
  supporting: PersonFeedback[];
  year: NumberFeedback;
  boxOffice: NumberFeedback;
  score: NumberFeedback;
  rating: [string | null, 'match' | 'miss' | 'na'];
  studio: [string, boolean];
  genres: ReturnType<typeof genre>[];
  isCorrect?: boolean;
}

const SAMPLES: Sample[] = [
  {
    title: 'Notting Hill',
    director: ['Roger Michell', [1], false],
    lead: person(10, 'Julia Roberts'),
    supporting: [person(11, 'Hugh Grant'), person(12, 'Rhys Ifans')],
    year: num(1999, 'miss', 'up'),
    boxOffice: num(364_000_000, 'miss', 'up'),
    score: num(72, 'miss', 'up'),
    rating: ['PG-13', 'match'],
    studio: ['Universal', false],
    genres: [genre(1, 'Comedy'), genre(2, 'Romance'), genre(3, 'Drama', true)],
  },
  {
    title: 'The Prestige',
    director: ['Christopher Nolan', [2], true],
    lead: person(20, 'Hugh Jackman'),
    supporting: [person(21, 'Christian Bale', true, 'lead'), person(22, 'Michael Caine', true, 'supp'), person(23, 'Scarlett Johansson')],
    year: num(2006, 'close', 'up'),
    boxOffice: num(109_000_000, 'miss', 'up'),
    score: num(82, 'close', 'up'),
    rating: ['PG-13', 'match'],
    studio: ['Touchstone', false],
    genres: [genre(3, 'Drama', true), genre(4, 'Mystery'), genre(5, 'Sci-Fi')],
  },
  {
    title: 'Hereditary',
    director: ['Ari Aster', [3], false],
    lead: person(30, 'Toni Collette'),
    supporting: [person(31, 'Alex Wolff')],
    year: num(2018, 'miss', 'down'),
    boxOffice: num(82_000_000, 'miss', 'up'),
    score: num(73, 'miss', 'up'),
    rating: ['R', 'miss'],
    studio: ['A24', false],
    genres: [genre(6, 'Horror'), genre(4, 'Mystery')],
  },
  {
    title: 'Iron Man',
    director: ['Jon Favreau', [4], false],
    lead: person(40, 'Robert Downey Jr.'),
    supporting: [person(41, 'Gwyneth Paltrow'), person(42, 'Terrence Howard'), person(43, 'Jeff Bridges')],
    year: num(2008, 'match'),
    boxOffice: num(585_000_000, 'close', 'up'),
    score: num(76, 'miss', 'up'),
    rating: ['PG-13', 'match'],
    studio: ['Marvel Studios', false],
    genres: [genre(7, 'Action', true), genre(5, 'Sci-Fi'), genre(8, 'Adventure')],
  },
  {
    title: 'The Dark Knight',
    director: ['Christopher Nolan', [2], true],
    lead: person(21, 'Christian Bale', true, 'lead'),
    supporting: [person(50, 'Heath Ledger', true, 'supp'), person(22, 'Michael Caine', true, 'supp'), person(51, 'Gary Oldman', true, 'supp')],
    year: num(2008, 'match'),
    boxOffice: num(1_006_000_000, 'match'),
    score: num(85, 'match'),
    rating: ['PG-13', 'match'],
    studio: ['Warner Bros.', true],
    genres: [genre(3, 'Drama', true), genre(7, 'Action', true), genre(9, 'Crime', true)],
    isCorrect: true,
  },
];

function toFeedback(s: Sample, i: number): GuessFeedback {
  return {
    filmId: 1000 + i,
    title: s.title,
    posterPath: null,
    director: { display: s.director[0], personIds: s.director[1], verdict: s.director[2] ? 'match' : 'miss' },
    lead: s.lead,
    supporting: s.supporting,
    year: s.year,
    boxOffice: s.boxOffice,
    score: s.score,
    rating: { value: s.rating[0], verdict: s.rating[1], region: 'US' },
    studio: { name: s.studio[0], logoPath: null, verdict: s.studio[1] ? 'match' : 'miss' },
    genres: s.genres,
    genreCount: 3,
    isCorrect: !!s.isCorrect,
  };
}

const ALL = SAMPLES.map(toFeedback);
const REEL = 212;

function Demo({ title, feedback, variant = 'panel' }: { title: string; feedback: GuessFeedback[]; variant?: 'panel' | 'drawer' }) {
  const [highlighted, setHighlighted] = useState<CallSheetRowId | null>(null);
  const [indices, setIndices] = useState<number[]>([]);
  return (
    <div className="flex flex-col gap-2">
      <p className="font-mono text-[11px] uppercase tracking-widest text-ink-dim">{title}</p>
      <CallSheet
        feedback={feedback}
        reelNumber={REEL}
        take={feedback.length}
        maxGuesses={RULES.maxGuesses}
        variant={variant}
        highlighted={highlighted}
        onRowSelect={(idx, id) => {
          setHighlighted(id);
          setIndices(idx);
        }}
      />
      <p className="font-mono text-[11px] text-ink-dim" aria-live="polite">
        Highlighted guesses: {indices.length ? indices.map((i) => feedback[i]?.title).join(', ') : 'none'}
      </p>
    </div>
  );
}

export default function CallSheetDevPage() {
  const [take, setTake] = useState(4);
  const live = ALL.slice(0, take);
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6">
      <h1 className="font-display text-2xl font-bold uppercase tracking-tight">
        Call Sheet <em className="font-serif font-normal normal-case">review</em>
      </h1>
      <p className="mt-1 text-sm text-ink-dim">Dev page. Sample feedback only. Resize to 375px to check the mobile strip.</p>

      <section className="mt-6 lg:hidden" aria-label="Mobile strip demo">
        <CallSheetStrip feedback={live} reelNumber={REEL} take={take} maxGuesses={RULES.maxGuesses} />
      </section>

      <div className="mt-6 flex items-center gap-3">
        <label htmlFor="take" className="font-mono text-xs uppercase tracking-widest text-ink-dim">
          Takes
        </label>
        <input
          id="take"
          type="range"
          min={0}
          max={ALL.length}
          value={take}
          onChange={(e) => setTake(Number(e.target.value))}
          className="w-48"
        />
        <span className="font-mono tabular-nums">{take}</span>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_24rem]">
        <div className="grid gap-8 md:grid-cols-2">
          <Demo title="Empty (take 0)" feedback={[]} />
          <Demo title="Take 1" feedback={ALL.slice(0, 1)} />
          <Demo title="Take 3" feedback={ALL.slice(0, 3)} />
          <Demo title="Solved (take 5)" feedback={ALL} />
          <Demo title="Drawer variant, take 4" feedback={ALL.slice(0, 4)} variant="drawer" />
          <div className="flex flex-col gap-4">
            <p className="font-mono text-[11px] uppercase tracking-widest text-ink-dim">RangeBar</p>
            <RangeBar label="Year between 2007 and 2011" domain={[2000, 2020]} lo={2007} hi={2011} ticks={[{ value: 2003 }, { value: 2014, emphasized: true }]} formatEdge={String} />
            <RangeBar label="Box office over $420M" domain={[100e6, 4e9]} lo={420e6} hi={null} ticks={[{ value: 210e6, emphasized: true }]} scale="log" formatEdge={(v) => `$${Math.round(v / 1e6)}M`} />
          </div>
        </div>
        <aside className="hidden lg:block">
          <div className="sticky top-4">
            <Demo title={`Sticky panel (slider: take ${take})`} feedback={live} />
          </div>
        </aside>
      </div>
    </main>
  );
}
