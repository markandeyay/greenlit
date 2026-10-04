import { describe, expect, it } from 'vitest';
import { COPY } from '@/config/brand';
import { PITCH } from '@/config/game';
import { RULES } from '@/config/rules';
import {
  describeTake,
  gameReducer,
  initialGameState,
  localRecordFor,
  noteSlots,
  noteThreshold,
  type GameState,
} from '@/lib/game/state';
import type { PlayStateResponse, Reveal } from '@/lib/types';
import { fb } from './fixtures';

const reveal: Reveal = { filmId: 9, title: 'X', year: 2000, posterPath: null, director: 'D', tagline: null, trailerYoutube: null };
const play = (over: Partial<PlayStateResponse> = {}): PlayStateResponse => ({
  kind: 'daily',
  ref: '4',
  status: 'in_progress',
  take: 0,
  feedback: [],
  hints: [],
  ...over,
});

describe('gameReducer', () => {
  it('resumes without marking old rows for animation', () => {
    const s = gameReducer(initialGameState, {
      type: 'resumed',
      play: play({ take: 2, feedback: [fb({ filmId: 1 }), fb({ filmId: 2 })] }),
    });
    expect(s.phase).toBe('ready');
    expect(s.feedback).toHaveLength(2);
    expect(s.animateFrom).toBe(2);
    expect(s.finishedLive).toBe(false);
  });

  it('resumes a finished play with its reveal', () => {
    const s = gameReducer(initialGameState, { type: 'resumed', play: play({ status: 'lost', take: 1, feedback: [fb()], reveal }) });
    expect(s.status).toBe('lost');
    expect(s.reveal).toEqual(reveal);
    expect(s.finishedLive).toBe(false);
  });

  it('appends a guess after the optimistic pending state', () => {
    let s: GameState = gameReducer(initialGameState, { type: 'resumed', play: play() });
    s = gameReducer(s, { type: 'guess_started', film: { id: 5, title: 'Heat', year: 1995, posterPath: null } });
    expect(s.pending?.id).toBe(5);
    s = gameReducer(s, { type: 'guess_succeeded', res: { feedback: fb({ filmId: 5 }), take: 1, status: 'in_progress' } });
    expect(s.pending).toBeNull();
    expect(s.feedback.map((f) => f.filmId)).toEqual([5]);
    expect(s.animateFrom).toBe(0);
    s = gameReducer(s, { type: 'guess_succeeded', res: { feedback: fb({ filmId: 5 }), take: 1, status: 'in_progress' } });
    expect(s.feedback).toHaveLength(1);
  });

  it('ignores a second guess while one is in flight, and clears pending on failure', () => {
    const s: GameState = gameReducer(gameReducer(initialGameState, { type: 'resumed', play: play() }), {
      type: 'guess_started',
      film: { id: 5, title: 'A', year: 1, posterPath: null },
    });
    const again = gameReducer(s, { type: 'guess_started', film: { id: 6, title: 'B', year: 1, posterPath: null } });
    expect(again.pending?.id).toBe(5);
    expect(gameReducer(s, { type: 'guess_failed' }).pending).toBeNull();
  });

  it('marks a live finish on win and on give up', () => {
    let s: GameState = gameReducer(initialGameState, { type: 'resumed', play: play() });
    const won = gameReducer(s, {
      type: 'guess_succeeded',
      res: { feedback: fb({ isCorrect: true }), take: 1, status: 'won', reveal },
    });
    expect(won.status).toBe('won');
    expect(won.finishedLive).toBe(true);
    expect(won.reveal).toEqual(reveal);
    s = gameReducer(s, { type: 'giveup_started' });
    expect(s.givingUp).toBe(true);
    s = gameReducer(s, { type: 'giveup_succeeded', res: { status: 'lost', reveal } });
    expect(s.status).toBe('lost');
    expect(s.finishedLive).toBe(true);
    expect(s.givingUp).toBe(false);
  });

  it('stores revealed hints by slot', () => {
    let s: GameState = gameReducer(initialGameState, { type: 'resumed', play: play() });
    s = gameReducer(s, { type: 'hint_revealed', used: { slot: 2, hint: { type: 'first_letter', payload: { letter: 'H' } } } });
    s = gameReducer(s, { type: 'hint_revealed', used: { slot: 1, hint: { type: 'tagline', payload: { text: 't' } } } });
    expect(s.hints.map((h) => h.slot)).toEqual([1, 2]);
  });
});

describe('helpers', () => {
  it('builds the local record only when finished', () => {
    const now = new Date('2026-10-04T12:00:00Z');
    expect(localRecordFor('daily', '4', { status: 'in_progress', feedback: [], hints: [] }, now)).toBeNull();
    expect(
      localRecordFor(
        'daily',
        '4',
        { status: 'won', feedback: [fb(), fb()], hints: [{ slot: 1, hint: { type: 'tagline', payload: { text: 't' } } }] },
        now,
      ),
    ).toEqual({ kind: 'daily', ref: '4', status: 'won', takes: 2, hintsUsed: 1, finishedAt: now.toISOString() });
  });

  it('reads note thresholds from config', () => {
    expect(noteThreshold('daily', 1)).toBe(RULES.hintUnlockAfter[0]);
    expect(noteThreshold('vault', 2)).toBe(RULES.hintUnlockAfter[1]);
    expect(noteThreshold('pitch', 1)).toBe(PITCH.noteUnlockAfter);
    expect(noteThreshold('pitch', 2)).toBeNull();
    expect(noteSlots('pitch')).toEqual([1]);
    expect(noteSlots('daily')).toEqual([1, 2]);
  });

  it('describes a take for the live region', () => {
    expect(describeTake(fb(), 3)).toBe(
      'Take 3: Heat. Director no match, Robert De Niro in the cast, year close, answer is later, box office off, answer is smaller, score exact, rating confirmed, 1 of 3 genres.',
    );
    expect(describeTake(fb({ director: { display: 'M', verdict: 'match', personIds: [1] } }), 1)).toContain(
      'Director confirmed',
    );
    expect(describeTake(fb({ isCorrect: true }), 4)).toBe(`Take 4: Heat. ${COPY.winStamp}. That is the film.`);
  });
});
