// Numeric comparison rules (Sections 4.2, 4.3), shared so the server evaluator (WS2) and the
// Call Sheet inversion (WS3) agree exactly. Pure and isomorphic. Owned by WS0.
//
// Definitions (a = answer value, g = guessed film's value):
//   Year:       match a == g; close |a - g| <= RULES.yearClose; else miss.
//   Score:      match a == g; close |a - g| <= RULES.scoreClose; else miss.
//   Box office: match max(a,g)/min(a,g) <= 1 + RULES.boxOfficeGreenPct  ("within 10%");
//               close max(a,g)/min(a,g) <= RULES.boxOfficeCloseRatio      ("within 2x");
//               else miss. Either side null (or <= 0) -> 'na'.
//   Direction:  'up' when a > g (answer is later/bigger/higher), 'down' when a < g,
//               null on match and on 'na'. Direction words show on close and miss cells.
import { RULES } from '@/config/rules';
import type { NumberFeedback } from '@/lib/types';

function direction(a: number, g: number): NumberFeedback['direction'] {
  return a > g ? 'up' : a < g ? 'down' : null;
}

function compareLinear(guess: number | null, answer: number | null, closeBand: number): NumberFeedback {
  if (guess === null || answer === null) return { value: guess, verdict: 'na', direction: null };
  if (guess === answer) return { value: guess, verdict: 'match', direction: null };
  const verdict = Math.abs(answer - guess) <= closeBand ? 'close' : 'miss';
  return { value: guess, verdict, direction: direction(answer, guess) };
}

export function compareYear(guess: number | null, answer: number | null): NumberFeedback {
  return compareLinear(guess, answer, RULES.yearClose);
}

export function compareScore(guess: number | null, answer: number | null): NumberFeedback {
  return compareLinear(guess, answer, RULES.scoreClose);
}

export function boxOfficeRatio(a: number, g: number): number {
  return Math.max(a, g) / Math.min(a, g);
}

export function compareBoxOffice(guess: number | null, answer: number | null): NumberFeedback {
  if (guess === null || answer === null || guess <= 0 || answer <= 0) {
    return { value: guess, verdict: 'na', direction: null };
  }
  const r = boxOfficeRatio(answer, guess);
  if (r <= 1 + RULES.boxOfficeGreenPct) return { value: guess, verdict: 'match', direction: null };
  const verdict = r <= RULES.boxOfficeCloseRatio ? 'close' : 'miss';
  return { value: guess, verdict, direction: direction(answer, guess) };
}
