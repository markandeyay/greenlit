// Logline share text (Section 7 style): spoiler free, shows the struggle.
//   Greenlit · Logline · Oct 4 · 3/6
//   ⬛⬛🟩
//   greenlit.example/modes/logline
import { APP_NAME, SITE_URL, shareHost } from '@/config/brand';
import type { ArtifactCell, ShareArtifact } from '@/components/share/artifact';
import type { LoglineStateResponse } from './types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-10-04" -> "Oct 4". */
export function shortShareDate(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return date;
  return `${MONTHS[Number(m[2]) - 1] ?? m[2]} ${Number(m[3])}`;
}

export const LOGLINE_SHARE_PATH = '/modes/logline';

export function loglineShareUrl(): string {
  return `${shareHost()}${LOGLINE_SHARE_PATH}`;
}

/** Share text for a finished round. A loss scores X. */
export function buildLoglineShare(state: Pick<LoglineStateResponse, 'date' | 'status' | 'take' | 'maxTakes' | 'guesses'>): string {
  const score = state.status === 'won' ? String(state.take) : 'X';
  const header = `${APP_NAME} · Logline · ${shortShareDate(state.date)} · ${score}/${state.maxTakes}`;
  const row = state.guesses.map((g) => (g.correct ? '🟩' : '⬛')).join('');
  return `${header}\n${row}\n${loglineShareUrl()}`;
}

/**
 * The spoiler-free share artifact (design brief v2 principle 8): the score, "takes", and one row
 * of verdict cells, a miss per wrong take then a match if the film was named. No title, no year.
 */
export function buildLoglineArtifact(
  state: Pick<LoglineStateResponse, 'date' | 'status' | 'take' | 'maxTakes' | 'guesses'>,
): ShareArtifact {
  const won = state.status === 'won';
  return {
    mode: 'logline',
    reelNumber: null,
    date: state.date,
    outcome: won ? 'won' : 'lost',
    stat: `${won ? state.take : 'X'}/${state.maxTakes}`,
    statCaption: 'takes',
    grid: [state.guesses.slice(0, 10).map((g): ArtifactCell => (g.correct ? 'match' : 'miss'))],
    url: `${SITE_URL.replace(/\/$/, '')}${LOGLINE_SHARE_PATH}`,
    text: buildLoglineShare(state),
  };
}
