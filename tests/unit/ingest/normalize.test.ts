import { describe, expect, it } from 'vitest';
import {
  billedCast,
  boxOfficeFrom,
  certificationsFor,
  cleanText,
  directorDisplay,
  eligibilityProblems,
  normalizeMovie,
  scoreFrom,
  theatricalReleaseYear,
  trailerKey,
  type TmdbMovie,
} from '../../../scripts/ingest/normalize';
import { buildTmdbLibrary } from '../../../scripts/ingest/build-library';
import { integrityProblems, parseLibrary } from '../../../scripts/ingest/schema';
import { RULES } from '@/config/rules';

const rd = (certification: string, type: number, date = '2007-11-21T00:00:00.000Z') => ({ certification, type, release_date: date });

/** Co-directed, complete film. */
const noCountry: TmdbMovie = {
  id: 6977,
  title: 'No Country for Old Men',
  original_title: 'No Country for Old Men',
  release_date: '2007-05-19', // Cannes premiere; theatrical is November
  poster_path: '/poster.jpg',
  backdrop_path: null,
  runtime: 122,
  revenue: 171627166,
  vote_average: 7.94,
  vote_count: 12000,
  popularity: 45.1234,
  tagline: 'There are no clean getaways.',
  genres: [{ id: 80, name: 'Crime' }, { id: 18, name: 'Drama' }, { id: 53, name: 'Thriller' }],
  production_companies: [{ id: 999999, name: 'Scott Rudin Productions' }, { id: 14, name: 'Miramax' }],
  credits: {
    cast: [
      { id: 3810, name: 'Javier Bardem', order: 1 },
      { id: 2176, name: 'Tommy Lee Jones', order: 0, profile_path: '/tlj.jpg' },
      { id: 16851, name: 'Josh Brolin', order: 2 },
      { id: 57755, name: 'Woody Harrelson', order: 3 },
      { id: 9015, name: 'Kelly Macdonald', order: 4 },
      { id: 1, name: 'Garret Dillahunt', order: 5 },
    ],
    crew: [
      { id: 1223, name: 'Joel Coen', job: 'Director' },
      { id: 1224, name: 'Ethan Coen', job: 'Director' },
      { id: 1223, name: 'Joel Coen', job: 'Screenplay' },
      { id: 1223, name: 'Joel Coen', job: 'Director' },
      { id: 7, name: 'Roger Deakins', job: 'Director of Photography' },
    ],
  },
  release_dates: {
    results: [
      { iso_3166_1: 'FR', release_dates: [rd('', 1, '2007-05-19T00:00:00.000Z')] },
      { iso_3166_1: 'US', release_dates: [rd('', 1, '2007-05-19T00:00:00.000Z'), rd('R', 3, '2007-11-09T00:00:00.000Z')] },
      { iso_3166_1: 'GB', release_dates: [rd('18', 4, '2008-06-01T00:00:00.000Z'), rd('15', 3, '2008-01-18T00:00:00.000Z')] },
      { iso_3166_1: 'DE', release_dates: [rd('', 3, '2008-02-28T00:00:00.000Z'), rd('16', 5)] },
      { iso_3166_1: 'IN', release_dates: [rd('', 3)] },
    ],
  },
  videos: {
    results: [
      { key: 'teaser00001', site: 'YouTube', type: 'Teaser', official: true, published_at: '2007-01-01' },
      { key: 'fanmade0001', site: 'YouTube', type: 'Trailer', official: false, published_at: '2006-01-01' },
      { key: 'official002', site: 'YouTube', type: 'Trailer', official: true, published_at: '2007-09-01' },
      { key: 'official001', site: 'YouTube', type: 'Trailer', official: true, published_at: '2007-08-01' },
      { key: 'vimeo000001', site: 'Vimeo', type: 'Trailer', official: true, published_at: '2007-01-01' },
    ],
  },
  keywords: { keywords: [{ id: 1, name: 'drug money' }, { id: 2, name: 'hitman' }, { id: 3, name: ' texas ' }] },
};

/** Single director, no revenue, no certifications, no tagline, short cast. */
const smallFilm: TmdbMovie = {
  id: 42,
  title: 'Tiny Film',
  original_title: 'Petit Film',
  release_date: '2015-03-01',
  revenue: 0,
  vote_average: 6.55,
  vote_count: 20,
  popularity: 2,
  tagline: '',
  genres: [{ id: 18, name: 'Drama' }],
  production_companies: [{ id: 555, name: 'Indie House' }],
  credits: { cast: [{ id: 50, name: 'Solo Actor', order: 0 }, { id: 51, name: 'Second Actor', order: 1 }], crew: [{ id: 60, name: 'Auteur', job: 'Director' }] },
  release_dates: { results: [] },
  videos: { results: [] },
};

describe('director units', () => {
  it('names known units and joins others', () => {
    expect(directorDisplay(['Joel Coen', 'Ethan Coen'])).toBe('The Coens');
    expect(directorDisplay(['Ethan Coen', 'Joel Coen'])).toBe('The Coens');
    expect(directorDisplay(['Anthony Russo', 'Joe Russo'])).toBe('The Russo Brothers');
    expect(directorDisplay(['Daniel Kwan', 'Daniel Scheinert'])).toBe('Daniels');
    expect(directorDisplay(['Phil Lord', 'Christopher Miller'])).toBe('Lord and Miller');
    expect(directorDisplay(['Lana Wachowski', 'Lilly Wachowski'])).toBe('The Wachowskis');
    expect(directorDisplay(['Roger Allers', 'Rob Minkoff'])).toBe('Roger Allers and Rob Minkoff');
    expect(directorDisplay(['A', 'B', 'C'])).toBe('A, B and C');
    expect(directorDisplay(['Christopher Nolan'])).toBe('Christopher Nolan');
  });
});

describe('normalizeMovie', () => {
  it('normalizes a co-directed film', () => {
    const n = normalizeMovie(noCountry)!;
    expect(n.film.directorUnit).toEqual({ ids: [1223, 1224], display: 'The Coens' });
    expect(n.film.leadPersonId).toBe(2176);
    expect(n.film.supportingIds).toEqual([3810, 16851, 57755, 9015]);
    expect(n.film.supportingIds.length).toBeLessThanOrEqual(RULES.maxSupportingCast);
    expect(n.film.releaseYear).toBe(2007);
    expect(n.film.releaseDate).toBe('2007-11-09');
    expect(n.film.boxOfficeUsd).toBe(171627166);
    expect(n.film.scoreSnapshot).toBe(79);
    expect(n.film.originalTitle).toBeNull();
    expect(n.film.trailerYoutube).toBe('official001');
    expect(n.film.keywords).toEqual(['drug money', 'hitman', 'texas']);
    expect(n.studioName).toBe('Miramax');
    expect(n.studioMapped).toBe(true);
    expect(n.certifications).toEqual([
      { filmId: 6977, region: 'US', rating: 'R' },
      { filmId: 6977, region: 'GB', rating: '15' },
      { filmId: 6977, region: 'DE', rating: '16' },
    ]);
    expect(n.people.find((p) => p.id === 2176)?.profilePath).toBe('/tlj.jpg');
    expect(n.people.filter((p) => p.id === 1223)).toHaveLength(1);
    expect(eligibilityProblems(n.film, n.certifications, { voteCount: 12000 })).toEqual([]);
  });

  it('handles missing revenue, certifications and tagline', () => {
    const n = normalizeMovie(smallFilm)!;
    expect(n.film.boxOfficeUsd).toBeNull();
    expect(n.certifications).toEqual([]);
    expect(n.film.tagline).toBeNull();
    expect(n.film.supportingIds).toEqual([51]);
    expect(n.film.originalTitle).toBe('Petit Film');
    expect(n.film.trailerYoutube).toBeNull();
    expect(n.film.releaseYear).toBe(2015);
    expect(n.studioName).toBe('Indie House');
    expect(n.studioMapped).toBe(false);
    const problems = eligibilityProblems(n.film, n.certifications, { voteCount: 20 });
    expect(problems).toEqual(expect.arrayContaining(['no box office', 'no US certification', 'no tagline', 'popularity below threshold', 'too few votes']));
  });

  it('skips films that cannot satisfy the schema', () => {
    expect(normalizeMovie({ ...smallFilm, credits: { cast: [], crew: [] } })).toBeNull();
    expect(normalizeMovie({ ...smallFilm, genres: [] })).toBeNull();
    expect(normalizeMovie({ ...smallFilm, release_date: '' })).toBeNull();
  });
});

describe('field helpers', () => {
  it('box office, score, text', () => {
    expect(boxOfficeFrom(0)).toBeNull();
    expect(boxOfficeFrom(undefined)).toBeNull();
    expect(boxOfficeFrom(1234.4)).toBe(1234);
    expect(scoreFrom(8.449)).toBe(84);
    expect(scoreFrom(7, 0)).toBeNull();
    expect(scoreFrom(11)).toBe(100);
    expect(cleanText('  One — two  ')).toBe('One, two');
    expect(cleanText('   ')).toBeNull();
  });

  it('falls back to an unofficial trailer and to release_date', () => {
    expect(trailerKey([{ key: 'unoffic0001', site: 'YouTube', type: 'Trailer', official: false }])).toBe('unoffic0001');
    expect(theatricalReleaseYear({ id: 1, title: 'x', release_date: '1999-01-01' })).toBe(1999);
  });

  it('dedupes cast and caps supporting', () => {
    const { lead, supporting } = billedCast([
      { id: 1, name: 'a', order: 0 },
      { id: 1, name: 'a', order: 7 },
      ...[2, 3, 4, 5, 6, 7].map((id) => ({ id, name: String(id), order: id })),
    ]);
    expect(lead?.id).toBe(1);
    expect(supporting.map((s) => s.id)).toEqual([2, 3, 4, 5]);
  });

  it('prefers theatrical certifications', () => {
    const certs = certificationsFor(noCountry);
    expect(certs.find((c) => c.region === 'GB')?.rating).toBe('15');
  });
});

describe('buildTmdbLibrary', () => {
  it('produces a valid, deterministic library and a report', () => {
    const a = buildTmdbLibrary([smallFilm, noCountry], { generatedAt: 'x' });
    const b = buildTmdbLibrary([noCountry, smallFilm, noCountry], { generatedAt: 'x' });
    expect(a).toEqual(b);
    expect(() => parseLibrary(a.lib)).not.toThrow();
    expect(integrityProblems(a.lib)).toEqual([]);
    expect(a.lib.source).toBe('tmdb');
    expect(a.lib.films.map((f) => f.id)).toEqual([42, 6977]);
    expect(a.lib.films.find((f) => f.id === 6977)?.isAnswerEligible).toBe(true);
    expect(a.lib.films.find((f) => f.id === 42)?.isAnswerEligible).toBe(false);
    const miramax = a.lib.studios.find((s) => s.name === 'Miramax')!;
    expect(a.lib.films.find((f) => f.id === 6977)?.studioId).toBe(miramax.id);
    expect(a.lib.studios.some((s) => s.name === 'Indie House')).toBe(true);
    expect(a.report.missingBoxOffice).toEqual([{ id: 42, title: 'Tiny Film', year: 2015 }]);
    expect(a.report.missingCertifications.find((x) => x.id === 42)?.missing).toHaveLength(6);
    expect(a.report.missingCertifications.find((x) => x.id === 6977)?.missing).toEqual(['CA', 'AU', 'IN']);
    expect(a.report.totals.answerEligible).toBe(1);
    expect(a.report.unmappedStudios).toEqual([{ name: 'Indie House', rawCompanyId: 555, films: 1 }]);
  });

  it('keeps curated awards only for films present', () => {
    const { lib } = buildTmdbLibrary([noCountry], { awards: [{ filmId: 6977, text: 'Won Best Picture' }, { filmId: 1, text: 'x' }] });
    expect(lib.awards).toEqual([{ filmId: 6977, text: 'Won Best Picture' }]);
  });
});
