// Engine resolution for kind 'unlimited' (9.1 item 19): refs resolve through resolveTarget, the
// classic engine plays them, and nothing touches daily stats.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setRepoForTesting } from '@/server/db';
import type { MemoryRepo } from '@/server/db/memory';
import { encrypt } from '@/server/db/secret';
import { ApiFailure } from '@/server/http';
import { resolveTarget } from '@/server/puzzles';
import { getPlayState, giveUp, submitGuess, type Identity } from '@/server/plays';
import { getHintOptions, revealHint } from '@/server/hints';
import { clearUnlimitedHintCacheForTesting, encodeUnlimitedRef, newUnlimitedReel } from '@/server/modes/unlimited';
import { RULES } from '@/config/rules';
import { kindSchema } from '@/server/engine/schemas';
import { fillers, nearFilm, NOW } from '../../engine/helpers';
import { ANSWER_ID, ANSWER_ID_RE, ANSWER_TITLE, soloRepo } from './helpers';

let repo: MemoryRepo;
let seq = 0;
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

function expectNoLeak(text: string) {
  expect(text).not.toContain(ANSWER_TITLE);
  expect(text).not.toMatch(ANSWER_ID_RE);
}

beforeEach(() => {
  repo = soloRepo();
  setRepoForTesting(repo);
  clearUnlimitedHintCacheForTesting();
});
afterEach(() => setRepoForTesting(undefined));

describe('unlimited resolution', () => {
  it("'unlimited' is an accepted play kind", () => {
    expect(kindSchema.parse('unlimited')).toBe('unlimited');
  });

  it('a dealt ref resolves to the dealt film, keyed by the ref itself, with drafted Script Notes', async () => {
    const { ref, band } = await newUnlimitedReel('popular');
    expect(band).toBe('popular');
    expectNoLeak(ref);
    const target = await resolveTarget('unlimited', ref, NOW);
    expect(target).toMatchObject({ kind: 'unlimited', ref, answerFilmId: ANSWER_ID, puzzleNumber: null });
    expect(target.hints.length).toBeGreaterThan(0);
    for (const h of target.hints) expect(JSON.stringify(h)).not.toContain(ANSWER_TITLE);
  });

  it('every failure is the same generic not_found that never names the film', async () => {
    const refs = [
      'garbage',
      '212',
      encrypt('u1:999999:popular:x'), // film missing
      encodeUnlimitedRef(fillers[0]!.id, 'popular'), // not answer-eligible
      encodeUnlimitedRef(ANSWER_ID, 'popular').slice(0, -3) + 'AAA', // tampered
    ];
    const messages = new Set<string>();
    for (const ref of refs) {
      const err = await failure(resolveTarget('unlimited', ref, NOW));
      expect(err.code).toBe('not_found');
      expectNoLeak(err.message);
      messages.add(err.message);
    }
    expect(messages.size).toBe(1);
  });

  it('a film that stops being answer-eligible no longer resolves', async () => {
    const { ref } = await newUnlimitedReel('cinephile');
    const film = (await repo.getFilm(ANSWER_ID))!;
    await repo.upsertFilms([{ ...film, isAnswerEligible: false }]);
    expect((await failure(resolveTarget('unlimited', ref, NOW))).code).toBe('not_found');
  });

  it('no eligible films: dealing fails cleanly', async () => {
    const film = (await repo.getFilm(ANSWER_ID))!;
    await repo.upsertFilms([{ ...film, isAnswerEligible: false }]);
    expect((await failure(newUnlimitedReel('deep_cut'))).code).toBe('not_found');
  });
});

describe('unlimited plays with the classic engine', () => {
  it('a win reveals only at the end, and never touches daily stats', async () => {
    const id = identity();
    const { ref } = await newUnlimitedReel('popular');
    const empty = await getPlayState(id, 'unlimited', ref, NOW);
    expect(empty).toMatchObject({ kind: 'unlimited', ref, status: 'in_progress', take: 0 });
    expectNoLeak(JSON.stringify(empty));

    const miss = await submitGuess(id, 'unlimited', ref, nearFilm.id, NOW);
    expect(miss.status).toBe('in_progress');
    expect(miss.reveal).toBeUndefined();
    expectNoLeak(JSON.stringify(miss));

    const win = await submitGuess(id, 'unlimited', ref, ANSWER_ID, NOW);
    expect(win.status).toBe('won');
    expect(win.reveal).toMatchObject({ filmId: ANSWER_ID, title: ANSWER_TITLE });

    const play = await repo.getPlay(id.anonId, 'unlimited', ref);
    expect(play).toMatchObject({ kind: 'unlimited', status: 'won', takes: 2 });
    expect(await repo.listPlays({ kind: 'daily' })).toHaveLength(0);
  });

  it('two reels of the same film are separate plays', async () => {
    const id = identity();
    const a = await newUnlimitedReel('popular');
    const b = await newUnlimitedReel('popular');
    expect(a.ref).not.toBe(b.ref);
    await giveUp(id, 'unlimited', a.ref, NOW);
    const fresh = await getPlayState(id, 'unlimited', b.ref, NOW);
    expect(fresh.status).toBe('in_progress');
    expect(fresh.reveal).toBeUndefined();
  });

  it('Script Notes follow the daily unlock rules', async () => {
    const id = identity();
    const { ref } = await newUnlimitedReel('popular');
    expect(await getHintOptions(id, 'unlimited', ref, NOW)).toEqual({ slot1: [], slot2: [] });
    for (let i = 0; i < RULES.hintUnlockAfter[0]; i++) await submitGuess(id, 'unlimited', ref, fillers[i]!.id, NOW);
    const opts = await getHintOptions(id, 'unlimited', ref, NOW);
    expect(opts.slot1.length).toBeGreaterThan(0);
    expect(opts.slot2).toEqual([]);
    const { hint } = await revealHint(id, 'unlimited', ref, 1, opts.slot1[0]!, NOW);
    expect(hint.type).toBe(opts.slot1[0]);
    expectNoLeak(JSON.stringify(hint));
  });
});
