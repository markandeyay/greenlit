import { describe, expect, it } from 'vitest';
import { UNLIMITED } from '@/config/modes';
import { encrypt } from '@/server/db/secret';
import {
  answerPool,
  bandBounds,
  bandFilms,
  decodeUnlimitedRef,
  encodeUnlimitedRef,
  pickBandFilm,
  UNLIMITED_BANDS,
} from '@/server/modes/unlimited';
import { bandFixture, film } from './helpers';

const ids = (fs: { id: number }[]) => fs.map((f) => f.id).sort((a, b) => a - b);

describe('opaque refs', () => {
  it('round trips the film id and band', () => {
    for (const band of UNLIMITED_BANDS) {
      expect(decodeUnlimitedRef(encodeUnlimitedRef(987654, band))).toEqual({ filmId: 987654, band });
    }
  });

  it('is opaque: no film id or band in the token, and a fresh token every time', () => {
    const a = encodeUnlimitedRef(987654, 'popular');
    const b = encodeUnlimitedRef(987654, 'popular');
    expect(a).not.toBe(b);
    for (const t of [a, b]) {
      expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(t).not.toContain('987654');
      expect(t.toLowerCase()).not.toContain('popular');
      expect(Buffer.from(t, 'base64url').toString('latin1')).not.toContain('987654');
    }
  });

  it('rejects tampered, truncated, foreign and malformed tokens', () => {
    const good = encodeUnlimitedRef(42, 'cinephile');
    const flipped = good.slice(0, 20) + (good[20] === 'A' ? 'B' : 'A') + good.slice(21);
    expect(decodeUnlimitedRef(flipped)).toBeNull();
    expect(decodeUnlimitedRef(good.slice(0, -2))).toBeNull();
    expect(decodeUnlimitedRef('')).toBeNull();
    expect(decodeUnlimitedRef('212')).toBeNull();
    expect(decodeUnlimitedRef('not a token!')).toBeNull();
    expect(decodeUnlimitedRef('x'.repeat(600))).toBeNull();
    // Validly encrypted, but not an unlimited payload.
    expect(decodeUnlimitedRef(encrypt('pitch:42'))).toBeNull();
    expect(decodeUnlimitedRef(encrypt('u1:42:nope:abc'))).toBeNull();
    expect(decodeUnlimitedRef(encrypt('u1:0:popular:abc'))).toBeNull();
    expect(decodeUnlimitedRef(encrypt('u1:-4:popular:abc'))).toBeNull();
    expect(decodeUnlimitedRef(encrypt('u2:42:popular:abc'))).toBeNull();
    expect(decodeUnlimitedRef(encrypt('u1:42:popular'))).toBeNull();
  });
});

describe('band selection', () => {
  it('bands are [min, next higher min) tiers from config', () => {
    expect(bandBounds('popular')).toEqual({ min: UNLIMITED.bands.popular.minPopularity, max: Infinity });
    expect(bandBounds('cinephile')).toEqual({
      min: UNLIMITED.bands.cinephile.minPopularity,
      max: UNLIMITED.bands.popular.minPopularity,
    });
    expect(bandBounds('deep_cut')).toEqual({
      min: UNLIMITED.bands.deep_cut.minPopularity,
      max: UNLIMITED.bands.cinephile.minPopularity,
    });
  });

  it('the pool is answer-eligible, playable films with known box office', () => {
    expect(ids(answerPool(bandFixture()))).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('splits the pool into tiers; null popularity counts as 0', () => {
    const films = bandFixture();
    expect(ids(bandFilms(films, 'popular'))).toEqual([1, 2]);
    expect(ids(bandFilms(films, 'cinephile'))).toEqual([3, 4]);
    expect(ids(bandFilms(films, 'deep_cut'))).toEqual([5, 6]);
  });

  it('an empty tier falls back to its rank third of the pool', () => {
    // Everything is popular: deep cut gets the least popular third, cinephile the middle.
    const films = [90, 85, 80, 75, 70, 65].map((p, i) => film({ id: i + 1, title: `F${i}`, popularity: p, isAnswerEligible: true }));
    expect(ids(bandFilms(films, 'popular'))).toEqual([1, 2, 3, 4, 5, 6]);
    expect(ids(bandFilms(films, 'cinephile'))).toEqual([3, 4]);
    expect(ids(bandFilms(films, 'deep_cut'))).toEqual([5, 6]);
  });

  it('a single-film pool deals that film for every band; an empty pool deals nothing', () => {
    const one = [film({ id: 7, title: 'Only', popularity: 99, isAnswerEligible: true })];
    for (const band of UNLIMITED_BANDS) expect(pickBandFilm(one, band, () => 0)?.id).toBe(7);
    expect(pickBandFilm([], 'popular', () => 0)).toBeNull();
  });

  it('picks with the rng and avoids the previous film when it can', () => {
    const films = bandFixture();
    expect(pickBandFilm(films, 'popular', () => 0)?.id).toBe(1);
    expect(pickBandFilm(films, 'popular', () => 1)?.id).toBe(2);
    expect(pickBandFilm(films, 'popular', () => 0, 1)?.id).toBe(2);
    const one = [film({ id: 7, title: 'Only', popularity: 99, isAnswerEligible: true })];
    expect(pickBandFilm(one, 'popular', () => 0, 7)?.id).toBe(7);
  });
});
