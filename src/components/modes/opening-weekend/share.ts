// Opening Weekend share text (WS9). Pure and isomorphic.
import { APP_NAME, SITE_URL } from '@/config/brand';
import type { OwMode } from '@/server/modes/opening-weekend/types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-10-04" -> "Oct 4". Timezone independent. */
export function monthDay(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return date;
  return `${MONTHS[Number(m[2]) - 1] ?? m[2]} ${Number(m[3])}`;
}

export function modeUrl(base: string = SITE_URL): string {
  return `${base.replace(/\/$/, '')}/modes/opening-weekend`;
}

/** "Greenlit · Opening Weekend · Oct 4 · 12 in a row". Practice runs say "Practice" instead of a date. */
export function shareLine(score: number, mode: OwMode, date: string | null): string {
  const when = mode === 'daily' && date ? monthDay(date) : 'Practice';
  return `${APP_NAME} · Opening Weekend · ${when} · ${score} in a row`;
}

/** Share line plus the mode URL, as posted. */
export function shareText(score: number, mode: OwMode, date: string | null, base?: string): string {
  return `${shareLine(score, mode, date)}\n${modeUrl(base)}`;
}
