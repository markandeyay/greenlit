// Extra modes (Section 5, WS9). Metadata for the /modes hub and every mode's tunable rules.
// Mode engines import their constants from here; never hardcode them.
import type { ModeKind } from '@/lib/types';

export type ModeId = 'classic' | 'unlimited' | ModeKind;

export interface ModeInfo {
  id: ModeId;
  /** URL segment under /modes (classic lives at /). */
  href: string;
  name: string;
  /** Title with one italic accent word, rendered by parseAccent: "*Unlimited* reel". */
  accentTitle: string;
  pitch: string;
  phase: 1 | 2 | 3;
  status: 'live' | 'later';
  /** Why a mode is not live yet (shown on the hub). */
  laterReason?: string;
}

export const MODES: ModeInfo[] = [
  { id: 'classic', href: '/', name: 'Classic', accentTitle: 'The *daily*', pitch: 'Deduce the film in 10 takes.', phase: 1, status: 'live' },
  { id: 'unlimited', href: '/modes/unlimited', name: 'Dailies Reel', accentTitle: 'Dailies *reel*', pitch: 'Endless practice rounds, pick your difficulty.', phase: 2, status: 'live' },
  { id: 'opening_weekend', href: '/modes/opening-weekend', name: 'Opening Weekend', accentTitle: 'Opening *weekend*', pitch: 'Two posters. Which one grossed more?', phase: 2, status: 'live' },
  { id: 'release_order', href: '/modes/release-order', name: 'Release Order', accentTitle: 'Release *order*', pitch: 'Sort five films by release date.', phase: 2, status: 'live' },
  { id: 'casting_call', href: '/modes/casting-call', name: 'Casting Call', accentTitle: 'Casting *call*', pitch: 'Connect two actors through shared films.', phase: 3, status: 'live' },
  { id: 'logline', href: '/modes/logline', name: 'Logline', accentTitle: 'The *logline*', pitch: 'Guess the film from a one line synopsis.', phase: 3, status: 'live' },
];

/** Not built: shown on the hub as coming later. */
export const LATER_MODES = [
  { name: 'Double Feature', pitch: 'Live 1v1, same film, race.', phase: 3 as const, laterReason: 'Needs a realtime backend.' },
  { name: 'Frame Lock', pitch: 'Guess from progressively uncropped stills.', phase: 3 as const, laterReason: 'Waiting on licensed stills.' },
];

/** Unlimited / Dailies Reel (Section 5). Bands are popularity cutoffs over answer-eligible films. */
export const UNLIMITED = {
  bands: {
    popular: { label: 'Popular', minPopularity: 60 },
    cinephile: { label: 'Cinephile', minPopularity: 30 },
    deep_cut: { label: 'Deep cut', minPopularity: 0 },
  },
  defaultBand: 'popular',
} as const;
export type UnlimitedBand = keyof typeof UNLIMITED.bands;

/** Opening Weekend: higher or lower on worldwide gross. */
export const OPENING_WEEKEND = {
  dailyRunSeconds: 60,
  /** Skip pairs whose grosses are within this ratio (too close to call fairly). */
  minRatio: 1.15,
} as const;

/** Release Order: one daily set. */
export const RELEASE_ORDER = {
  filmsPerSet: 5,
  maxAttempts: 3,
  /** Films in a set must be at least this many days apart so ties are impossible. */
  minDaysApart: 30,
} as const;

/** Casting Call: daily start and end actor, chain through shared films. */
export const CASTING_CALL = {
  maxLinks: 6,
  /** Daily pairs are chosen with a shortest path of this many films (inclusive range). */
  targetPathFilms: [2, 3] as const,
} as const;

/** Logline: the synopsis gets less vague each take. */
export const LOGLINE = {
  maxTakes: 6,
  tiers: 4, // logline tiers written per film, most vague first
} as const;
