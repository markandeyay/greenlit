// Casting Call share line and share artifact (WS9, design brief v2 principle 8). Pure. Spoiler
// free: counts only, never names, titles or years.
//   {APP_NAME} · Casting Call · Oct 4 · 3 films (optimal 2)
//   🟩🟩🟨
//   https://site/modes/casting-call
//
// The verdict row has one cell per film the player used:
//   won:  the first `optimal` films are match (🟩, "on par"), any extra films are close (🟨,
//         "connected, but over the optimal chain"). A perfect chain is all green.
//   lost: one miss (⬛) per film used, at least one cell (walking away before any link).
// Only counts are encoded, so the grid can never reveal who or what was in the chain.
import { APP_NAME, SITE_URL } from '@/config/brand';
import { plural } from '@/lib/format';
import type { PlayStatus } from '@/lib/types';
import type { ArtifactCell, ShareArtifact } from '@/components/share/artifact';

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

const MAX_CELLS = 10;

/** One verdict cell per film used (see the header comment). */
export function castingShareRow({ status, films, optimal }: Pick<CastingShareInput, 'status' | 'films' | 'optimal'>): ArtifactCell[] {
  if (status === 'won') {
    const n = Math.min(Math.max(films, 1), MAX_CELLS);
    return Array.from({ length: n }, (_, i): ArtifactCell => (i < optimal ? 'match' : 'close'));
  }
  return Array.from({ length: Math.min(Math.max(films, 1), MAX_CELLS) }, (): ArtifactCell => 'miss');
}

const EMOJI: Record<ArtifactCell, string> = { match: '🟩', close: '🟨', miss: '⬛', empty: '⬜' };

export function castingShareHeader({ date, status, films, optimal }: CastingShareInput): string {
  const score = status === 'won' ? plural(films, 'film') : 'No connection';
  return `${APP_NAME} · Casting Call · ${shortDay(date)} · ${score} (optimal ${optimal})`;
}

export function castingShareText(input: CastingShareInput, site?: string): string {
  const row = castingShareRow(input)
    .map((c) => EMOJI[c])
    .join('');
  return `${castingShareHeader(input)}\n${row}\n${castingShareUrl(site)}`;
}

/** The spoiler-free artifact rendered by ShareArtifactPanel. */
export function castingShareArtifact(input: CastingShareInput, site?: string): ShareArtifact {
  const won = input.status === 'won';
  return {
    mode: 'casting_call',
    reelNumber: null,
    date: input.date,
    outcome: won ? 'won' : 'lost',
    stat: won ? plural(input.films, 'film') : 'X',
    statCaption: `optimal ${input.optimal}`,
    grid: [castingShareRow(input)],
    url: castingShareUrl(site),
    text: castingShareText(input, site),
  };
}
