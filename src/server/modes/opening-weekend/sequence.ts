// Opening Weekend pair generation (WS9). Pure and deterministic: the same pool and seed always give
// the same sequence of pairs, so the daily run is identical for everyone and any serverless
// instance can rebuild pair N from the seed alone.
//
// Rules: winner stays in its slot, a new challenger takes the loser's slot. Pairs whose grosses are
// within OPENING_WEEKEND.minRatio of each other are never produced. Challengers are drawn from the
// films nearest the current card on a randomly chosen side, so the card that stays climbs slowly
// instead of jumping straight to the top grosser, and a card that has stayed on screen for
// MAX_TENURE pairs is retired with a fresh pair dealt, so "always pick the card that stayed" never
// becomes a winning strategy.
import { OPENING_WEEKEND } from '@/config/modes';
import type { Film } from '@/lib/types';
import type { OwCard, OwSide } from './types';

export interface OwFilm extends OwCard {
  gross: number;
}

export interface OwPair {
  step: number;
  left: OwFilm;
  right: OwFilm;
}

/** How many nearest candidates on the chosen side the challenger is drawn from. */
const NEAREST = 8;
/** Most consecutive pairs any one card stays on screen before a fresh pair is dealt. */
export const MAX_TENURE = 4;

/** Films eligible for the mode: playable with a known, positive worldwide gross. Stable order. */
export function buildPool(films: Film[]): OwFilm[] {
  return films
    .filter((f) => f.isPlayable && typeof f.boxOfficeUsd === 'number' && Number.isFinite(f.boxOfficeUsd) && f.boxOfficeUsd > 0)
    .map((f) => ({ id: f.id, title: f.title, year: f.releaseYear, posterPath: f.posterPath, gross: f.boxOfficeUsd as number }))
    .sort((a, b) => a.gross - b.gross || a.id - b.id);
}

/** True when the two grosses are far enough apart to be a fair call. */
export function isFairPair(a: number, b: number, minRatio: number = OPENING_WEEKEND.minRatio): boolean {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return lo > 0 && hi / lo >= minRatio;
}

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32: tiny, fast, good enough for shuffling a film deck. */
export function seededRandom(seed: string): () => number {
  let a = hashSeed(seed) || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickChallenger(
  pool: OwFilm[],
  champ: OwFilm,
  used: Set<number>,
  rand: () => number,
  minRatio: number,
): OwFilm | null {
  const higher = pool.filter((f) => !used.has(f.id) && f.gross >= champ.gross * minRatio);
  const lower = pool.filter((f) => !used.has(f.id) && f.gross * minRatio <= champ.gross).reverse();
  let side: OwFilm[];
  if (higher.length && lower.length) side = rand() < 0.5 ? higher : lower;
  else side = higher.length ? higher : lower;
  if (!side.length) return null;
  const near = side.slice(0, NEAREST);
  return near[Math.floor(rand() * near.length)]!;
}

/**
 * The first `count` pairs of a run. Returns fewer only when the pool cannot form a fair pair.
 * Pair k assumes the player answered pairs 0..k-1 correctly (a wrong answer ends the run).
 */
export function buildSequence(pool: OwFilm[], seed: string, count: number, minRatio: number = OPENING_WEEKEND.minRatio): OwPair[] {
  const out: OwPair[] = [];
  if (pool.length < 2 || count <= 0) return out;
  const rand = seededRandom(seed);
  // Start from the lower middle of the gross range so the run has room to climb.
  const lo = Math.floor(pool.length * 0.15);
  const hi = Math.max(lo + 1, Math.floor(pool.length * 0.6));
  let champ = pool[lo + Math.floor(rand() * (hi - lo))]!;
  let champSide: OwSide = rand() < 0.5 ? 'left' : 'right';
  let tenure = 0;
  const used = new Set<number>([champ.id]);

  for (let step = 0; step < count; step++) {
    let challenger = pickChallenger(pool, champ, used, rand, minRatio);
    if (!challenger) {
      // Deck exhausted: reshuffle everything except the cards just seen.
      const last = out[out.length - 1];
      used.clear();
      used.add(champ.id);
      if (last) {
        used.add(last.left.id);
        used.add(last.right.id);
      }
      challenger = pickChallenger(pool, champ, used, rand, minRatio);
      if (!challenger && last) {
        used.clear();
        used.add(champ.id);
        challenger = pickChallenger(pool, champ, used, rand, minRatio);
      }
      if (!challenger) break;
    }
    used.add(challenger.id);
    out.push(champSide === 'left' ? { step, left: champ, right: challenger } : { step, left: challenger, right: champ });
    tenure += 1;
    if (challenger.gross > champ.gross) {
      // The challenger wins and stays in the slot it already occupies.
      champ = challenger;
      champSide = champSide === 'left' ? 'right' : 'left';
      tenure = 1; // it has already been on screen for this pair
    }
    if (tenure >= MAX_TENURE) {
      // Retire the long-running card: deal a fresh one from the unused deck.
      const fresh = pool.filter((f) => !used.has(f.id));
      const deck = fresh.length ? fresh : pool.filter((f) => f.id !== champ.id);
      champ = deck[Math.floor(rand() * deck.length)]!;
      champSide = rand() < 0.5 ? 'left' : 'right';
      used.add(champ.id);
      tenure = 0;
    }
  }
  return out;
}

/** Which side grossed more. Sequences never contain ties. */
export function higherSide(pair: OwPair): OwSide {
  return pair.left.gross > pair.right.gross ? 'left' : 'right';
}

export function toCard(f: OwFilm): OwCard {
  return { id: f.id, title: f.title, year: f.year, posterPath: f.posterPath };
}
