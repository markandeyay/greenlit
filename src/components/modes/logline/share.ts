// Logline share text (Section 7 style): spoiler free, shows the struggle.
//   Greenlit · Logline · Oct 4 · 3/6
//   🟥🟥🟩
//   greenlit.example/modes/logline
import { APP_NAME, shareHost } from '@/config/brand';
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
  const row = state.guesses.map((g) => (g.correct ? '🟩' : '🟥')).join('');
  return `${header}\n${row}\n${loglineShareUrl()}`;
}
