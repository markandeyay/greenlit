import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import lib from '@/server/db/fixtures/library.json';
import type { LibrarySnapshot } from '@/server/db/repo';
import { RULES } from '@/config/rules';
import { integrityProblems, parseLibrary } from '../../../scripts/ingest/schema';
import { buildFixtureLibrary } from '../../../scripts/ingest/build-fixtures';
import { formatLibraryJson } from '../../../scripts/ingest/io';
import { syntheticPersonId, KNOWN_PERSON_IDS } from '../../../scripts/ingest/fixture-source/people';

const library = lib as LibrarySnapshot;
const eligible = library.films.filter((f) => f.isAnswerEligible);

function allStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => allStrings(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => allStrings(v, out));
  return out;
}

describe('fixture library', () => {
  it('matches the LibrarySnapshot schema', () => {
    expect(() => parseLibrary(library)).not.toThrow();
    expect(library.source).toBe('fixture');
  });

  it('is referentially consistent with no duplicates', () => {
    expect(integrityProblems(library)).toEqual([]);
    const ids = library.films.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('respects cast and genre caps', () => {
    for (const f of library.films) {
      expect(f.supportingIds.length).toBeLessThanOrEqual(RULES.maxSupportingCast);
      expect(f.genreIds.length).toBeGreaterThanOrEqual(1);
      expect(f.genreIds.length).toBeLessThanOrEqual(5);
    }
    expect(library.films.some((f) => f.supportingIds.length < RULES.maxSupportingCast)).toBe(true);
  });

  it('every eligible film has box office, a US certification and a tagline', () => {
    for (const f of eligible) {
      expect(f.boxOfficeUsd, f.title).not.toBeNull();
      expect(f.tagline, f.title).toBeTruthy();
      expect(library.certifications.some((c) => c.filmId === f.id && c.region === 'US'), f.title).toBe(true);
      expect(f.leadPersonId, f.title).not.toBeNull();
    }
  });

  it('has enough eligible films for 55+ days without repeats', () => {
    expect(eligible.length).toBeGreaterThanOrEqual(55);
  });

  it('has a few films with unknown box office, none of them eligible', () => {
    const unknown = library.films.filter((f) => f.boxOfficeUsd === null);
    expect(unknown.length).toBeGreaterThanOrEqual(3);
    expect(unknown.every((f) => !f.isAnswerEligible)).toBe(true);
  });

  it('has at least 4 co-directing units', () => {
    const units = new Set(library.films.filter((f) => f.directorUnit.ids.length > 1).map((f) => f.directorUnit.ids.join(',')));
    expect(units.size).toBeGreaterThanOrEqual(4);
    const displays = new Set(library.films.map((f) => f.directorUnit.display));
    for (const d of ['The Coens', 'The Russo Brothers', 'Daniels', 'Lord and Miller', 'The Wachowskis']) expect(displays).toContain(d);
  });

  it('has at least 10 actors appearing in 2+ films', () => {
    const count = new Map<number, number>();
    for (const f of library.films) {
      for (const id of [f.leadPersonId, ...f.supportingIds]) if (id !== null) count.set(id, (count.get(id) ?? 0) + 1);
    }
    expect([...count.values()].filter((c) => c >= 2).length).toBeGreaterThanOrEqual(10);
  });

  it('spans decades, studios and box office scales', () => {
    const decades = new Set(library.films.map((f) => Math.floor(f.releaseYear / 10) * 10));
    for (const d of [1970, 1980, 1990, 2000, 2010, 2020]) expect(decades).toContain(d);
    expect(new Set(eligible.map((f) => f.studioId)).size).toBeGreaterThanOrEqual(12);
    const grosses = eligible.map((f) => f.boxOfficeUsd!);
    expect(Math.min(...grosses)).toBeLessThan(50_000_000);
    expect(Math.max(...grosses)).toBeGreaterThan(2_500_000_000);
  });

  it('has some films missing non-US certifications', () => {
    const regions = new Map<number, Set<string>>();
    for (const c of library.certifications) regions.set(c.filmId, (regions.get(c.filmId) ?? new Set()).add(c.region));
    expect(library.films.some((f) => (regions.get(f.id)?.size ?? 0) < 6)).toBe(true);
  });

  it('has curated awards only for films in the library', () => {
    expect(library.awards.length).toBeGreaterThan(20);
    expect(library.awards.some((a) => a.text === 'Won Best Picture')).toBe(true);
  });

  it('contains no em dashes in any text field', () => {
    for (const s of allStrings(library)) expect(s.includes('—'), s).toBe(false);
  });

  it('is up to date with the fixture source (run build-fixtures.ts after editing the source)', () => {
    const file = fs.readFileSync(path.resolve('src/server/db/fixtures/library.json'), 'utf8').replace(/\r\n/g, '\n');
    expect(file).toBe(formatLibraryJson(buildFixtureLibrary()));
  });

  it('gives the same person the same id everywhere', () => {
    expect(syntheticPersonId('Fionn Whitehead')).toBe(syntheticPersonId('Fionn Whitehead'));
    const names = new Map<string, number>();
    for (const p of library.people) {
      expect(names.has(p.name), p.name).toBe(false);
      names.set(p.name, p.id);
    }
    expect(names.get('Leonardo DiCaprio')).toBe(KNOWN_PERSON_IDS['Leonardo DiCaprio']);
  });
});
