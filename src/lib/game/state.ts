// Client game state (WS5). A pure reducer plus helpers, so the whole round can be unit tested
// without a DOM. Everything here is derived from API feedback; the answer is only known once the
// server sends `reveal` at the end of the round.
import { COPY } from '@/config/brand';
import { PITCH } from '@/config/game';
import { RULES } from '@/config/rules';
import { directionWord } from '@/components/ui/status';
import type {
  GiveUpResponse,
  GuessFeedback,
  GuessResponse,
  HintSlot,
  LocalPlayRecord,
  ClassicKind,
  PlayStateResponse,
  PlayStatus,
  Reveal,
  SearchResult,
  UsedHint,
} from '@/lib/types';

export interface GameState {
  phase: 'loading' | 'ready' | 'error';
  status: PlayStatus;
  /** Oldest first, exactly as the API returns it. */
  feedback: GuessFeedback[];
  hints: UsedHint[];
  reveal: Reveal | null;
  /** The film whose guess is in flight (optimistic row). */
  pending: SearchResult | null;
  givingUp: boolean;
  /** Rows at index >= animateFrom were added this session and play their reveal animation. */
  animateFrom: number;
  /** True when the round ended during this page view (drives the stamp animation). */
  finishedLive: boolean;
  loadError: string | null;
}

export const initialGameState: GameState = {
  phase: 'loading',
  status: 'in_progress',
  feedback: [],
  hints: [],
  reveal: null,
  pending: null,
  givingUp: false,
  animateFrom: 0,
  finishedLive: false,
  loadError: null,
};

export type GameAction =
  | { type: 'resumed'; play: PlayStateResponse }
  | { type: 'load_failed'; message: string }
  | { type: 'guess_started'; film: SearchResult }
  | { type: 'guess_succeeded'; res: GuessResponse }
  | { type: 'guess_failed' }
  | { type: 'giveup_started' }
  | { type: 'giveup_succeeded'; res: GiveUpResponse }
  | { type: 'giveup_failed' }
  | { type: 'hint_revealed'; used: UsedHint };

function sortHints(hints: UsedHint[]): UsedHint[] {
  return [...hints].sort((a, b) => a.slot - b.slot);
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'resumed': {
      const p = action.play;
      // A resync after the first load keeps the animation cursor so old rows never re-animate.
      const animateFrom = state.phase === 'loading' ? p.feedback.length : Math.min(state.animateFrom, p.feedback.length);
      return {
        ...state,
        phase: 'ready',
        status: p.status,
        feedback: p.feedback,
        hints: sortHints(p.hints),
        reveal: p.reveal ?? null,
        pending: null,
        givingUp: false,
        animateFrom,
        loadError: null,
      };
    }
    case 'load_failed':
      return { ...state, phase: 'error', loadError: action.message };
    case 'guess_started':
      if (state.status !== 'in_progress' || state.pending) return state;
      return { ...state, pending: action.film };
    case 'guess_succeeded': {
      const { feedback, status, reveal } = action.res;
      const already = state.feedback.some((f) => f.filmId === feedback.filmId);
      const finished = status !== 'in_progress';
      return {
        ...state,
        feedback: already ? state.feedback : [...state.feedback, feedback],
        status,
        reveal: reveal ?? state.reveal,
        pending: null,
        finishedLive: state.finishedLive || (finished && state.status === 'in_progress'),
      };
    }
    case 'guess_failed':
      return { ...state, pending: null };
    case 'giveup_started':
      return { ...state, givingUp: true };
    case 'giveup_succeeded':
      return {
        ...state,
        givingUp: false,
        status: 'lost',
        reveal: action.res.reveal,
        finishedLive: state.finishedLive || state.status === 'in_progress',
      };
    case 'giveup_failed':
      return { ...state, givingUp: false };
    case 'hint_revealed': {
      const others = state.hints.filter((h) => h.slot !== action.used.slot);
      return { ...state, hints: sortHints([...others, action.used]) };
    }
    default:
      return state;
  }
}

export const takeOf = (s: Pick<GameState, 'feedback'>) => s.feedback.length;

export const isFinished = (s: Pick<GameState, 'status'>) => s.status !== 'in_progress';

/** The record stored on this device when a round finishes, or null while in progress. */
export function localRecordFor(
  kind: ClassicKind,
  ref: string,
  s: Pick<GameState, 'status' | 'feedback' | 'hints'>,
  now: Date = new Date(),
): LocalPlayRecord | null {
  if (s.status === 'in_progress') return null;
  return {
    kind,
    ref,
    status: s.status,
    takes: s.feedback.length,
    hintsUsed: s.hints.length,
    finishedAt: now.toISOString(),
  };
}

/** Take after which a Script Note slot unlocks for this kind, or null when the slot never exists. */
export function noteThreshold(kind: ClassicKind, slot: HintSlot): number | null {
  if (kind === 'pitch') return slot === 1 ? PITCH.noteUnlockAfter : null;
  return RULES.hintUnlockAfter[slot - 1] ?? null;
}

/** Number of note slots a kind offers. */
export function noteSlots(kind: ClassicKind): HintSlot[] {
  return kind === 'pitch' ? [1] : [1, 2];
}

/**
 * Live-region summary of one take, e.g.
 * "Take 3: Heat. Director confirmed, year close, answer is later, 1 of 3 genres."
 */
export function describeTake(fb: GuessFeedback, take: number): string {
  const head = `Take ${take}: ${fb.title}.`;
  if (fb.isCorrect) return `${head} ${COPY.winStamp}. That is the film.`;
  const parts: string[] = [];
  parts.push(fb.director.verdict === 'match' ? 'director confirmed' : 'director no match');
  const cast = [fb.lead, ...fb.supporting].filter((p): p is NonNullable<typeof p> => !!p && p.verdict === 'match');
  if (cast.length) parts.push(`${cast.map((p) => p.name).join(' and ')} in the cast`);
  const num = (label: string, attr: 'year' | 'boxOffice' | 'score', n: GuessFeedback['year']) => {
    if (n.verdict === 'na') return;
    if (n.verdict === 'match') {
      parts.push(`${label} exact`);
      return;
    }
    const word = directionWord(attr, n.direction, n.verdict);
    const v = n.verdict === 'close' ? `${label} close` : `${label} off`;
    parts.push(word ? `${v}, answer is ${word.toLowerCase()}` : v);
  };
  num('year', 'year', fb.year);
  num('box office', 'boxOffice', fb.boxOffice);
  num('score', 'score', fb.score);
  if (fb.rating.verdict === 'match') parts.push('rating confirmed');
  if (fb.studio.verdict === 'match') parts.push('studio confirmed');
  const g = fb.genres.filter((x) => x.verdict === 'match').length;
  parts.push(`${g} of ${fb.genreCount} genres`);
  const body = parts.join(', ');
  return `${head} ${body.charAt(0).toUpperCase()}${body.slice(1)}.`;
}
