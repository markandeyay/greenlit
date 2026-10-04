import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { computeCallSheet, rangeContains } from '@/lib/callsheet';
import { simulateFeedback, type SimFilm } from './helpers';

const RATINGS = ['G', 'PG', 'PG-13', 'R', 'NC-17'];
const STUDIOS = ['A24', 'Disney', 'Universal', 'Warner Bros.', 'Paramount', 'Focus'];

// Small id pools so guesses frequently overlap with the answer.
const filmArb = (id: fc.Arbitrary<number>, nullableNumbers: boolean): fc.Arbitrary<SimFilm> =>
  fc
    .record({
      id,
      year: nullableNumbers ? fc.option(fc.integer({ min: 1920, max: 2026 }), { freq: 8 }) : fc.integer({ min: 1920, max: 2026 }),
      // Integers (USD) plus a continuous mix around round values.
      boxOffice: nullableNumbers
        ? fc.option(fc.oneof(fc.integer({ min: 1, max: 3_000_000_000 }), fc.double({ min: 1, max: 3e9, noNaN: true })), { freq: 6 })
        : fc.oneof(fc.integer({ min: 1, max: 3_000_000_000 }), fc.double({ min: 1, max: 3e9, noNaN: true })),
      score: nullableNumbers ? fc.option(fc.integer({ min: 0, max: 100 }), { freq: 8 }) : fc.integer({ min: 0, max: 100 }),
      directorIds: fc.uniqueArray(fc.integer({ min: 1, max: 12 }), { minLength: 1, maxLength: 2 }),
      leadId: fc.option(fc.integer({ min: 100, max: 130 }), { freq: 10 }),
      supportingIds: fc.uniqueArray(fc.integer({ min: 100, max: 130 }), { maxLength: 4 }),
      studio: fc.constantFrom(...STUDIOS),
      rating: fc.option(fc.constantFrom(...RATINGS), { freq: 6 }),
      genres: fc.uniqueArray(fc.integer({ min: 1, max: 12 }), { minLength: 1, maxLength: 5 }),
    })
    .map((f) => ({
      ...f,
      title: `Film ${f.id}`,
      directorDisplay: `Unit ${f.directorIds.join('+')}`,
      supportingIds: f.supportingIds.filter((s) => s !== f.leadId),
    }));

const answerArb = filmArb(fc.constant(0), false);
const guessesArb = fc.array(filmArb(fc.integer({ min: 1, max: 100_000 }), true), { minLength: 1, maxLength: 10 });

const sizeNear = fc.double({ min: 0.3, max: 3, noNaN: true });

describe('Call Sheet property tests (fed real feedback from verdicts.ts)', () => {
  it('derived ranges always contain the true answer value', () => {
    fc.assert(
      fc.property(answerArb, guessesArb, (answer, guesses) => {
        const s = computeCallSheet(guesses.map((g) => simulateFeedback(answer, g)));
        expect(s.conflict).toBe(false);
        expect(rangeContains(s.year, answer.year!)).toBe(true);
        expect(rangeContains(s.score, answer.score!)).toBe(true);
        expect(rangeContains(s.boxOffice, answer.boxOffice!)).toBe(true);
        if (s.year.status === 'exact') expect(s.year.exact).toBe(answer.year);
        if (s.score.status === 'exact') expect(s.score.exact).toBe(answer.score);
      }),
      { numRuns: 1500 },
    );
  });

  it('box office near the green/close thresholds stays contained', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1_000, max: 2_000_000_000 }),
        fc.array(sizeNear, { minLength: 1, maxLength: 10 }),
        fc.boolean(),
        (truth, factors, roundGuesses) => {
          const answer: SimFilm = {
            id: 0, title: 'A', year: 2000, boxOffice: truth, score: 50, directorIds: [1], directorDisplay: 'D',
            leadId: null, supportingIds: [], studio: 'A24', rating: 'R', genres: [1],
          };
          // Include exact threshold multiples to hit the boundaries.
          const extra = [1.1, 1 / 1.1, 2, 0.5];
          const guesses = [...factors, ...extra].map((f, i) => ({
            ...answer,
            id: i + 1,
            boxOffice: roundGuesses ? Math.max(1, Math.round(truth * f)) : truth * f,
          }));
          const s = computeCallSheet(guesses.map((g) => simulateFeedback(answer, g)));
          expect(s.boxOffice.status).not.toBe('conflict');
          expect(rangeContains(s.boxOffice, truth)).toBe(true);
        },
      ),
      { numRuns: 1000 },
    );
  });

  it('confirmed and ruled-out sets agree with the truth', () => {
    fc.assert(
      fc.property(answerArb, guessesArb, (answer, guesses) => {
        const s = computeCallSheet(guesses.map((g) => simulateFeedback(answer, g)));
        const cast = [answer.leadId, ...answer.supportingIds].filter((x): x is number => x !== null);

        if (s.director.confirmed) {
          expect(s.director.confirmed.personIds.some((id) => answer.directorIds.includes(id))).toBe(true);
        }
        for (const d of s.director.cut) expect(d.personIds.some((id) => answer.directorIds.includes(id))).toBe(false);

        for (const c of s.cast.confirmed) {
          expect(cast).toContain(c.personId);
          expect(c.answerRole).toBe(c.personId === answer.leadId ? 'lead' : 'supp');
        }
        for (const c of s.cast.cut) expect(cast).not.toContain(c.personId);
        const ids = [...s.cast.confirmed, ...s.cast.cut].map((c) => c.personId);
        expect(new Set(ids).size).toBe(ids.length);

        if (s.rating.confirmed) expect(s.rating.confirmed.value).toBe(answer.rating);
        for (const r of s.rating.cut) expect(r.value).not.toBe(answer.rating);

        if (s.studio.confirmed) expect(s.studio.confirmed.name).toBe(answer.studio);
        for (const st of s.studio.cut) expect(st.name).not.toBe(answer.studio);

        for (const g of s.genres.confirmed) expect(answer.genres).toContain(g.id);
        for (const g of s.genres.cut) expect(answer.genres).not.toContain(g.id);
        expect(s.genres.total).toBe(answer.genres.length);
        expect(s.genres.remaining).toBe(answer.genres.length - s.genres.confirmed.length);

        // Every guess index listed in any row is a real guess.
        const all = [s.year, s.boxOffice, s.score, s.director, s.cast, s.rating, s.studio, s.genres].flatMap(
          (x) => x.guessIndices,
        );
        for (const i of all) expect(i >= 0 && i < guesses.length).toBe(true);
      }),
      { numRuns: 1000 },
    );
  });
});
