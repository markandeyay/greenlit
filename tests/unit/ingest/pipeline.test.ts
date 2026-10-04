import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import lib from '@/server/db/fixtures/library.json';
import type { LibrarySnapshot } from '@/server/db/repo';
import type { SearchIndexFile } from '@/lib/types';
import { STUDIO_ALIAS_SEED, HEADLINE_STUDIOS, StudioRegistry, aliasRows, pickHeadlineStudio } from '../../../scripts/ingest/studios';
import { buildSearchIndex, formatSearchIndex } from '../../../scripts/ingest/build-search-index';
import { TmdbClient, mapLimit, parseRetryAfter, TmdbHttpError } from '../../../scripts/ingest/tmdb-client';
import { mergeCandidates, parseArgs } from '../../../scripts/ingest/tmdb-fetch';
import { parseEnv } from '../../../scripts/ingest/io';
import { chunk, toRows } from '../../../scripts/ingest/load-supabase';

const library = lib as LibrarySnapshot;

describe('studios', () => {
  it('alias seed maps only to headline studios, with unique company ids', () => {
    const ids = STUDIO_ALIAS_SEED.map((a) => a.rawCompanyId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of STUDIO_ALIAS_SEED) expect(HEADLINE_STUDIOS as readonly string[]).toContain(a.studio);
    expect(aliasRows().find((a) => a.rawCompanyId === 174)?.studioId).toBe(1);
  });

  it('keeps New Line separate and folds sub-brands', () => {
    const m = new Map(STUDIO_ALIAS_SEED.map((a) => [a.rawCompanyId, a.studio]));
    expect(m.get(12)).toBe('New Line');
    expect(m.get(5)).toBe('Sony');
    expect(m.get(43)).toBe('Searchlight');
    expect(m.get(3)).toBe('Pixar');
  });

  it('picks the first mapped company, else the first company name', () => {
    expect(pickHeadlineStudio([{ id: 1, name: 'Lucasfilm Ltd.' }, { id: 25, name: '20th Century Fox' }])?.name).toBe('Lucasfilm');
    expect(pickHeadlineStudio([{ id: 9999999, name: 'Syncopy' }, { id: 174, name: 'Warner Bros. Pictures' }])?.name).toBe('Warner Bros.');
    expect(pickHeadlineStudio([{ id: 9999999, name: ' Syncopy ' }])).toEqual({ name: 'Syncopy', rawCompanyId: 9999999, mapped: false });
    expect(pickHeadlineStudio([])).toBeNull();
  });

  it('registry ids are stable', () => {
    const r = new StudioRegistry();
    expect(r.idFor('Warner Bros.')).toBe(1);
    const extra = r.idFor('Syncopy');
    expect(extra).toBe(HEADLINE_STUDIOS.length + 1);
    expect(r.idFor('Syncopy')).toBe(extra);
  });
});

describe('search index', () => {
  it('lists every playable film with only safe fields', () => {
    const index = buildSearchIndex(library);
    expect(index.v).toBe(1);
    expect(index.films.length).toBe(library.films.filter((f) => f.isPlayable).length);
    for (const f of index.films) {
      for (const k of Object.keys(f)) expect(['id', 'title', 'originalTitle', 'year', 'posterPath']).toContain(k);
    }
    expect(index.films.find((f) => f.id === 496243)?.originalTitle).toBe('기생충');
  });

  it('public/search-index.json is current', () => {
    const file = fs.readFileSync(path.resolve('public/search-index.json'), 'utf8').replace(/\r\n/g, '\n');
    const parsed = JSON.parse(file) as SearchIndexFile;
    expect(parsed).toEqual(buildSearchIndex(library));
    expect(file).toBe(formatSearchIndex(buildSearchIndex(library)));
    expect(file).not.toMatch(/eligib|puzzle|schedule|boxOffice/i);
  });
});

describe('tmdb client', () => {
  const okJson = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

  it('parses Retry-After', () => {
    expect(parseRetryAfter('3')).toBe(3000);
    expect(parseRetryAfter(null)).toBeNull();
    expect(parseRetryAfter('Wed, 21 Oct 2015 07:28:10 GMT', Date.parse('Wed, 21 Oct 2015 07:28:00 GMT'))).toBe(10000);
    expect(parseRetryAfter('nonsense')).toBeNull();
  });

  it('retries 429 and 5xx honoring Retry-After, with bearer auth', async () => {
    const sleeps: number[] = [];
    const calls: { url: string; auth?: string }[] = [];
    const responses = [
      new Response('slow down', { status: 429, headers: { 'retry-after': '2' } }),
      new Response('oops', { status: 503 }),
      okJson({ id: 1 }),
    ];
    const client = new TmdbClient({
      auth: { readToken: 'tok' },
      fetchImpl: (async (url: string, init?: RequestInit) => {
        calls.push({ url, auth: (init?.headers as Record<string, string>).authorization });
        return responses.shift()!;
      }) as unknown as typeof fetch,
      sleep: async (ms) => void sleeps.push(ms),
      baseBackoffMs: 100,
    });
    await expect(client.get('/movie/1', { language: 'en-US' })).resolves.toEqual({ id: 1 });
    expect(calls).toHaveLength(3);
    expect(calls[0]!.auth).toBe('Bearer tok');
    expect(calls[0]!.url).not.toContain('api_key');
    expect(sleeps[0]).toBe(2000);
    expect(sleeps[1]).toBeGreaterThanOrEqual(200);
  });

  it('does not retry 404 and uses api_key when no token', async () => {
    let n = 0;
    let seenUrl = '';
    const client = new TmdbClient({
      auth: { apiKey: 'k' },
      fetchImpl: (async (url: string) => {
        n++;
        seenUrl = url;
        return new Response('nope', { status: 404 });
      }) as unknown as typeof fetch,
      sleep: async () => undefined,
    });
    await expect(client.get('/movie/999')).rejects.toBeInstanceOf(TmdbHttpError);
    expect(n).toBe(1);
    expect(seenUrl).toContain('api_key=k');
  });

  it('keeps request starts within the budget window', async () => {
    let clock = 0;
    const starts: number[] = [];
    const client = new TmdbClient({
      auth: { readToken: 't' },
      budget: 5,
      windowMs: 1000,
      concurrency: 3,
      now: () => clock,
      sleep: async (ms) => void (clock += ms),
      fetchImpl: (async () => {
        starts.push(clock);
        return okJson({});
      }) as unknown as typeof fetch,
    });
    await Promise.all(Array.from({ length: 12 }, (_, i) => client.get(`/x/${i}`)));
    expect(starts).toHaveLength(12);
    for (const t of starts) expect(starts.filter((s) => s >= t && s < t + 1000).length).toBeLessThanOrEqual(5);
  });

  it('mapLimit caps concurrency and keeps order', async () => {
    let active = 0;
    let peak = 0;
    const out = await mapLimit([1, 2, 3, 4, 5, 6], 2, async (x) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 1));
      active--;
      return x * 2;
    });
    expect(out).toEqual([2, 4, 6, 8, 10, 12]);
    expect(peak).toBeLessThanOrEqual(2);
  });
});

describe('fetch helpers', () => {
  it('merges candidates round-robin without duplicates', () => {
    expect(mergeCandidates([[1, 2, 3], [2, 4], [5]], 10)).toEqual([1, 2, 5, 4, 3]);
    expect(mergeCandidates([[1, 2, 3], [4, 5, 6]], 3)).toEqual([1, 4, 2]);
  });
  it('parses args', () => {
    expect(parseArgs(['--target', '100', '--refresh']).target).toBe(100);
    expect(() => parseArgs(['--bogus'])).toThrow();
  });
  it('parses env files', () => {
    expect(parseEnv('# c\nA=1\nexport B="two words"\nC=x # note\nD=\n')).toEqual({ A: '1', B: 'two words', C: 'x', D: '' });
  });
});

describe('supabase rows', () => {
  it('maps to snake_case columns and remaps studio ids', () => {
    const rows = toRows(library, new Map(library.studios.map((s) => [s.id, s.id + 100])));
    const film = rows.films.find((f) => f.id === 27205)!;
    expect(film.studio_id).toBe(101);
    expect(film.director_unit).toEqual({ ids: [525], display: 'Christopher Nolan' });
    expect(Object.keys(film)).toContain('is_answer_eligible');
    expect(rows.studioAliases.every((a) => a.studio_id! > 100)).toBe(true);
    expect(rows.certifications[0]).toHaveProperty('film_id');
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});
