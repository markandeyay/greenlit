// Unlimited test fixtures, built on the engine test library. In `soloRepo` only the engine's
// secret answer film is answer-eligible, so every band deals it and the leak checks are exact.
import { MemoryRepo, createMemoryState } from '@/server/db/memory';
import type { Film } from '@/lib/types';
import { ANSWER_ID, ANSWER_TITLE, film, library } from '../../engine/helpers';

export { ANSWER_ID, ANSWER_TITLE, film };
export const ANSWER_ID_RE = new RegExp(`\\b${ANSWER_ID}\\b`);

export function soloRepo(): MemoryRepo {
  const lib = structuredClone(library);
  lib.films = lib.films.map((f) => (f.id === ANSWER_ID ? f : { ...f, isAnswerEligible: false }));
  return new MemoryRepo(createMemoryState(lib));
}

/** A small answer pool spread across the default band cutoffs (60 / 30 / 0). */
export function bandFixture(): Film[] {
  return [
    film({ id: 1, title: 'Pop A', popularity: 90, isAnswerEligible: true }),
    film({ id: 2, title: 'Pop B', popularity: 60, isAnswerEligible: true }),
    film({ id: 3, title: 'Cine A', popularity: 59.9, isAnswerEligible: true }),
    film({ id: 4, title: 'Cine B', popularity: 30, isAnswerEligible: true }),
    film({ id: 5, title: 'Deep A', popularity: 29, isAnswerEligible: true }),
    film({ id: 6, title: 'Deep Null', popularity: null, isAnswerEligible: true }),
    film({ id: 7, title: 'Not eligible', popularity: 95, isAnswerEligible: false }),
    film({ id: 8, title: 'No box office', popularity: 95, isAnswerEligible: true, boxOfficeUsd: null }),
    film({ id: 9, title: 'Unplayable', popularity: 95, isAnswerEligible: true, isPlayable: false }),
  ];
}
