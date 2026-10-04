import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setRepoForTesting } from '@/server/db';
import type { MemoryRepo } from '@/server/db/memory';
import { getPlayState, giveUp, submitGuess, type Identity } from '@/server/plays';
import { getToday, getVaultPuzzle, listVault, resolveTarget } from '@/server/puzzles';
import { computeHintOptions, getHintOptions, revealHint } from '@/server/hints';
import { getDailyStatsPublic } from '@/server/stats';
import { ApiFailure } from '@/server/http';
import { RULES } from '@/config/rules';
import { dateForPuzzleNumber } from '@/lib/dates';
import { PITCH } from '@/config/game';
import {
  ANSWER_ID,
  buildRepo,
  fillers,
  FUTURE_ANSWER_ID,
  nearFilm,
  NOW,
  PITCH_NO_NOTE_SLUG,
  PITCH_NOTE,
  PITCH_SLUG,
  todayNumber,
  unplayableFilm,
  VAULT_ANSWER_ID,
} from './helpers';

let repo: MemoryRepo;
let seq = 0;
const T = todayNumber(NOW);
const today = String(T);

function identity(): Identity {
  seq++;
  return { anonId: `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`, isNewAnon: false, profileId: null, region: 'US' };
}

async function failure(p: Promise<unknown>): Promise<ApiFailure> {
  try {
    await p;
  } catch (e) {
    if (e instanceof ApiFailure) return e;
    throw e;
  }
  throw new Error('expected ApiFailure');
}

async function guessFillers(id: Identity, count: number, kind: 'daily' | 'vault' | 'pitch' = 'daily', ref = today) {
  let last;
  for (let i = 0; i < count; i++) last = await submitGuess(id, kind, ref, fillers[i]!.id, NOW);
  return last!;
}

beforeEach(async () => {
  repo = await buildRepo(NOW);
  setRepoForTesting(repo);
});
afterEach(() => setRepoForTesting(undefined));

describe('puzzle resolution', () => {
  it('daily accepts only today and canonicalizes the ref', async () => {
    const t = await resolveTarget('daily', `00${T}`, NOW);
    expect(t.ref).toBe(today);
    expect(t.answerFilmId).toBe(ANSWER_ID);
  });
  it('daily rejects past and future refs', async () => {
    expect((await failure(resolveTarget('daily', String(T - 1), NOW))).code).toBe('not_found');
    expect((await failure(resolveTarget('daily', String(T + 1), NOW))).code).toBe('not_found');
    expect((await failure(resolveTarget('daily', 'abc', NOW))).code).toBe('bad_request');
  });
  it('vault rejects today, the future, and pre-launch refs', async () => {
    for (const ref of [String(T), String(T + 1), '0']) {
      expect((await failure(resolveTarget('vault', ref, NOW))).code).toBe('not_found');
    }
    expect((await resolveTarget('vault', String(T - 1), NOW)).answerFilmId).toBe(VAULT_ANSWER_ID);
  });
  it('vault never serves a puzzle whose date is today or later even if mis-numbered', async () => {
    const p = (await repo.getPuzzle(T - 1))!;
    await repo.deletePuzzle(T + 1);
    await repo.upsertPuzzle({ ...p, date: dateForPuzzleNumber(T + 1) });
    expect((await failure(resolveTarget('vault', String(T - 1), NOW))).code).toBe('not_found');
  });
  it('pitch resolves by slug; unknown slugs are not_found', async () => {
    expect((await resolveTarget('pitch', PITCH_SLUG, NOW)).answerFilmId).toBe(ANSWER_ID);
    expect((await failure(resolveTarget('pitch', 'nope0000', NOW))).code).toBe('not_found');
    expect((await failure(resolveTarget('pitch', '../etc', NOW))).code).toBe('not_found');
  });
  it('today payload has no answer and the vault lists only past puzzles', async () => {
    const t = await getToday(NOW);
    expect(t).toEqual({ number: T, date: expect.any(String), theme: 'Coens Week', nextResetAt: expect.any(String) });
    const vault = await listVault(NOW);
    expect(vault.map((p) => p.number)).toEqual(Array.from({ length: T - 1 }, (_, i) => T - 1 - i));
    expect(Object.keys(vault[0]!).sort()).toEqual(['date', 'number', 'theme']);
    expect(await getVaultPuzzle(T, NOW)).toBeNull();
    expect(await getVaultPuzzle(T - 1, NOW)).toMatchObject({ number: T - 1 });
    expect(JSON.stringify(vault)).not.toContain(String(FUTURE_ANSWER_ID));
  });
});

describe('guessing', () => {
  it('records takes, firstGuessAt, and returns no reveal while in progress', async () => {
    const id = identity();
    const r = await submitGuess(id, 'daily', today, nearFilm.id, NOW);
    expect(r.take).toBe(1);
    expect(r.status).toBe('in_progress');
    expect(r.reveal).toBeUndefined();
    const play = (await repo.getPlay(id.anonId, 'daily', today))!;
    expect(play.guesses).toEqual([nearFilm.id]);
    expect(play.firstGuessAt).toBe(NOW.toISOString());
    expect(play.takes).toBeNull();
  });
  it('rejects duplicate guesses', async () => {
    const id = identity();
    await submitGuess(id, 'daily', today, nearFilm.id, NOW);
    expect((await failure(submitGuess(id, 'daily', today, nearFilm.id, NOW))).code).toBe('already_guessed');
  });
  it('rejects unknown and unplayable films', async () => {
    const id = identity();
    expect((await failure(submitGuess(id, 'daily', today, 424242, NOW))).code).toBe('not_found');
    expect((await failure(submitGuess(id, 'daily', today, unplayableFilm.id, NOW))).code).toBe('not_found');
  });
  it('a win reveals, records takes and daily stats, and later guesses are game_over', async () => {
    const id = identity();
    await submitGuess(id, 'daily', today, nearFilm.id, NOW);
    const r = await submitGuess(id, 'daily', today, ANSWER_ID, NOW);
    expect(r.status).toBe('won');
    expect(r.take).toBe(2);
    expect(r.feedback.isCorrect).toBe(true);
    expect(r.reveal).toMatchObject({ filmId: ANSWER_ID, title: 'Zephyr Quartermile', year: 2007, director: 'The Coens' });
    const play = (await repo.getPlay(id.anonId, 'daily', today))!;
    expect(play).toMatchObject({ status: 'won', takes: 2 });
    expect(play.finishedAt).not.toBeNull();
    expect((await failure(submitGuess(id, 'daily', today, fillers[0]!.id, NOW))).code).toBe('game_over');
    const stats = await getDailyStatsPublic(T, NOW);
    expect(stats).toMatchObject({ plays: 1, wins: 1 });
    expect(stats.distribution[1]).toBe(1);
  });
  it(`loses after RULES.maxGuesses (${RULES.maxGuesses}) wrong takes`, async () => {
    const id = identity();
    const before = await guessFillers(id, RULES.maxGuesses - 1);
    expect(before.status).toBe('in_progress');
    expect(before.reveal).toBeUndefined();
    const last = await submitGuess(id, 'daily', today, fillers[RULES.maxGuesses - 1]!.id, NOW);
    expect(last.status).toBe('lost');
    expect(last.take).toBe(RULES.maxGuesses);
    expect(last.reveal?.filmId).toBe(ANSWER_ID);
    expect((await failure(submitGuess(id, 'daily', today, fillers[RULES.maxGuesses]!.id, NOW))).code).toBe('game_over');
    const stats = await getDailyStatsPublic(T, NOW);
    expect(stats.distribution[10]).toBe(1);
    expect(stats.wins).toBe(0);
  });
  it('vault and pitch plays do not touch daily stats and are separate plays', async () => {
    const id = identity();
    await submitGuess(id, 'vault', String(T - 1), VAULT_ANSWER_ID, NOW);
    await submitGuess(id, 'pitch', PITCH_SLUG, ANSWER_ID, NOW);
    expect(await repo.getDailyStats(T - 1)).toBeNull();
    expect(await repo.getDailyStats(T)).toBeNull();
    expect((await getPlayState(id, 'daily', today, NOW)).take).toBe(0);
  });
});

describe('give up', () => {
  it('ends the round as lost with a reveal and records a turnaround', async () => {
    const id = identity();
    await submitGuess(id, 'daily', today, nearFilm.id, NOW);
    const r = await giveUp(id, 'daily', today, NOW);
    expect(r).toMatchObject({ status: 'lost', reveal: { filmId: ANSWER_ID } });
    expect((await repo.getPlay(id.anonId, 'daily', today))).toMatchObject({ status: 'lost', takes: 1 });
    expect((await failure(submitGuess(id, 'daily', today, fillers[0]!.id, NOW))).code).toBe('game_over');
    // Idempotent: a second give up returns the reveal again without double counting.
    await giveUp(id, 'daily', today, NOW);
    expect((await getDailyStatsPublic(T, NOW)).plays).toBe(1);
  });
  it('cannot give up a won round', async () => {
    const id = identity();
    await submitGuess(id, 'daily', today, ANSWER_ID, NOW);
    expect((await failure(giveUp(id, 'daily', today, NOW))).code).toBe('game_over');
  });
});

describe('play state', () => {
  it('empty state with no play', async () => {
    expect(await getPlayState(identity(), 'daily', today, NOW)).toEqual({
      kind: 'daily', ref: today, status: 'in_progress', take: 0, feedback: [], hints: [],
    });
  });
  it('re-evaluates guesses in order for the current region and adds the reveal once finished', async () => {
    const id = identity();
    await submitGuess(id, 'daily', today, nearFilm.id, NOW);
    await submitGuess(id, 'daily', today, fillers[0]!.id, NOW);
    const s = await getPlayState({ ...id, region: 'GB' }, 'daily', today, NOW);
    expect(s.feedback.map((f) => f.filmId)).toEqual([nearFilm.id, fillers[0]!.id]);
    expect(s.feedback[0]!.rating).toEqual({ value: null, verdict: 'na', region: 'GB' });
    expect(s.reveal).toBeUndefined();
    await giveUp(id, 'daily', today, NOW);
    expect((await getPlayState(id, 'daily', today, NOW)).reveal?.filmId).toBe(ANSWER_ID);
  });
  it('a signed-in profile finds its play from another device', async () => {
    const a = { ...identity(), profileId: 'prof-1' };
    await submitGuess(a, 'daily', today, nearFilm.id, NOW);
    const otherDevice = { ...identity(), profileId: 'prof-1' };
    expect((await getPlayState(otherDevice, 'daily', today, NOW)).take).toBe(1);
    expect((await repo.getPlay(a.anonId, 'daily', today))!.profileId).toBe('prof-1');
  });
});

describe('Script Notes (4.8)', () => {
  const [unlock1, unlock2] = RULES.hintUnlockAfter;

  it('slot 1 is locked before the threshold', async () => {
    const id = identity();
    await guessFillers(id, unlock1 - 1);
    expect(await getHintOptions(id, 'daily', today, NOW)).toEqual({ slot1: [], slot2: [] });
    expect((await failure(revealHint(id, 'daily', today, 1, 'tagline', NOW))).code).toBe('hint_locked');
  });
  it('slot 1 unlocks at the threshold and never offers first_letter', async () => {
    const id = identity();
    await guessFillers(id, unlock1);
    const opts = await getHintOptions(id, 'daily', today, NOW);
    expect(opts.slot1).toEqual(['tagline', 'plot_keywords']);
    expect(opts.slot2).toEqual([]);
    expect((await failure(revealHint(id, 'daily', today, 1, 'first_letter', NOW))).code).toBe('hint_unavailable');
    expect((await failure(revealHint(id, 'daily', today, 1, 'awards', NOW))).code).toBe('hint_unavailable');
    const r = await revealHint(id, 'daily', today, 1, 'tagline', NOW);
    expect(r.hint).toEqual({ type: 'tagline', payload: { text: 'A secret tagline nobody should see early' } });
    expect((await repo.getPlay(id.anonId, 'daily', today))!.hintsUsed).toEqual(['tagline']);
    expect((await failure(revealHint(id, 'daily', today, 1, 'plot_keywords', NOW))).code).toBe('hint_unavailable');
    // Re-fetching the used note returns its content (resume).
    expect((await revealHint(id, 'daily', today, 1, 'tagline', NOW)).hint.type).toBe('tagline');
    expect((await getHintOptions(id, 'daily', today, NOW)).slot1).toEqual([]);
  });
  it('slot 2 unlocks at its threshold, excludes used types, and allows first_letter', async () => {
    const id = identity();
    await guessFillers(id, unlock2 - 1);
    await revealHint(id, 'daily', today, 1, 'tagline', NOW);
    expect((await getHintOptions(id, 'daily', today, NOW)).slot2).toEqual([]);
    expect((await failure(revealHint(id, 'daily', today, 2, 'first_letter', NOW))).code).toBe('hint_locked');
    await submitGuess(id, 'daily', today, fillers[unlock2 - 1]!.id, NOW);
    expect((await getHintOptions(id, 'daily', today, NOW)).slot2).toEqual(['first_letter', 'plot_keywords']);
    expect((await revealHint(id, 'daily', today, 2, 'first_letter', NOW)).hint).toEqual({ type: 'first_letter', payload: { letter: 'Z' } });
    const state = await getPlayState(id, 'daily', today, NOW);
    expect(state.hints.map((h) => [h.slot, h.hint.type])).toEqual([[1, 'tagline'], [2, 'first_letter']]);
  });
  it('slot 2 requires slot 1 first', async () => {
    const id = identity();
    await guessFillers(id, unlock2);
    expect((await getHintOptions(id, 'daily', today, NOW)).slot2).toEqual([]);
    expect((await failure(revealHint(id, 'daily', today, 2, 'plot_keywords', NOW))).code).toBe('hint_locked');
  });
  it('no new notes after the round ends', async () => {
    const id = identity();
    await guessFillers(id, unlock1);
    await giveUp(id, 'daily', today, NOW);
    expect(await getHintOptions(id, 'daily', today, NOW)).toEqual({ slot1: [], slot2: [] });
    expect((await failure(revealHint(id, 'daily', today, 1, 'tagline', NOW))).code).toBe('game_over');
  });
  it('pitch: creator_note in slot 1 after PITCH.noteUnlockAfter takes, nothing in slot 2', async () => {
    const id = identity();
    await guessFillers(id, PITCH.noteUnlockAfter - 1, 'pitch', PITCH_SLUG);
    expect(await getHintOptions(id, 'pitch', PITCH_SLUG, NOW)).toEqual({ slot1: [], slot2: [] });
    await submitGuess(id, 'pitch', PITCH_SLUG, fillers[PITCH.noteUnlockAfter]!.id, NOW);
    expect(await getHintOptions(id, 'pitch', PITCH_SLUG, NOW)).toEqual({ slot1: ['creator_note'], slot2: [] });
    expect((await revealHint(id, 'pitch', PITCH_SLUG, 1, 'creator_note', NOW)).hint).toEqual({
      type: 'creator_note', payload: { text: PITCH_NOTE },
    });
  });
  it('pitch without a note offers nothing', async () => {
    const id = identity();
    await guessFillers(id, PITCH.noteUnlockAfter + 1, 'pitch', PITCH_NO_NOTE_SLUG);
    expect(await getHintOptions(id, 'pitch', PITCH_NO_NOTE_SLUG, NOW)).toEqual({ slot1: [], slot2: [] });
    expect((await failure(revealHint(id, 'pitch', PITCH_NO_NOTE_SLUG, 1, 'creator_note', NOW))).code).toBe('hint_unavailable');
  });
  it('computeHintOptions with no play is locked', async () => {
    const t = await resolveTarget('daily', today, NOW);
    expect(computeHintOptions(t, null)).toEqual({ slot1: [], slot2: [] });
  });
});

describe('daily stats', () => {
  it('only for released puzzles', async () => {
    expect((await getDailyStatsPublic(T, NOW)).distribution).toHaveLength(11);
    expect((await failure(getDailyStatsPublic(T + 1, NOW))).code).toBe('not_found');
    expect((await failure(getDailyStatsPublic(0, NOW))).code).toBe('not_found');
  });
});
