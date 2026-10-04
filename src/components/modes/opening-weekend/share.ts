// Opening Weekend share text (WS9). Pure and isomorphic.
import { APP_NAME, SITE_URL } from '@/config/brand';
import type { ArtifactCell, ShareArtifact } from '@/components/share/artifact';
import type { OwMode, OwOutcome } from '@/server/modes/opening-weekend/types';

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

/** Most cells in the artifact's one-row grid. */
export const OW_GRID_MAX = 10;

/**
 * Spoiler-free share artifact for a finished run: the streak as the stat and one row of up to 10
 * cells (a match per correct pick, then a miss when the run ended on a wrong pick). No titles,
 * posters, years or grosses.
 */
export function owArtifact(
  score: number,
  mode: OwMode,
  date: string | null,
  outcome: OwOutcome | null,
  base?: string,
): ShareArtifact {
  const wrong = outcome === 'wrong';
  const matches = Math.max(0, Math.min(score, wrong ? OW_GRID_MAX - 1 : OW_GRID_MAX));
  const row: ArtifactCell[] = [...Array<ArtifactCell>(matches).fill('match'), ...(wrong ? (['miss'] as const) : [])];
  return {
    mode: 'opening_weekend',
    reelNumber: null,
    date: mode === 'daily' ? date : null,
    outcome: 'score',
    stat: String(Math.max(0, score)),
    statCaption: 'in a row',
    grid: row.length ? [row] : [],
    url: modeUrl(base),
    text: shareText(score, mode, date, base),
  };
}
