// Casting Call share line (WS9). Pure. Spoiler free: counts only, never names or titles.
// "{APP_NAME} · Casting Call · Oct 4 · 3 films (optimal 2)" then the URL.
import { APP_NAME, SITE_URL } from '@/config/brand';
import { plural } from '@/lib/format';
import type { PlayStatus } from '@/lib/types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-10-04" -> "Oct 4". Timezone independent. */
export function shortDay(date: string): string {
  const [, m, d] = date.split('-').map(Number);
  if (!m || !d || m < 1 || m > 12) return date;
  return `${MONTHS[m - 1]} ${d}`;
}

export const CASTING_PATH = '/modes/casting-call';

export function castingShareUrl(site: string = SITE_URL): string {
  return `${site.replace(/\/$/, '')}${CASTING_PATH}`;
}

export interface CastingShareInput {
  date: string;
  status: Exclude<PlayStatus, 'in_progress'>;
  /** Films in the player's chain. */
  films: number;
  optimal: number;
}

export function castingShareHeader({ date, status, films, optimal }: CastingShareInput): string {
  const score = status === 'won' ? plural(films, 'film') : 'No connection';
  return `${APP_NAME} · Casting Call · ${shortDay(date)} · ${score} (optimal ${optimal})`;
}

export function castingShareText(input: CastingShareInput, site?: string): string {
  return `${castingShareHeader(input)}\n${castingShareUrl(site)}`;
}
