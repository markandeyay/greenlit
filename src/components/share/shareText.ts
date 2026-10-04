// Share text (WS6, Section 7.1). Text only: verdict squares, never a title, id or spoiler.
//
//   Greenlit · Reel 212 · Take 4/10
//   🎬 ⬛⬛⬛🟩🟨⬛🟩⬛
//   🎬 🟩⬛⬛🟩🟩🟨🟩⬛
//   🎬 🟩🟩⬛🟩🟩🟩🟩🟨
//   🟢 🟩🟩🟩🟩🟩🟩🟩🟩
//   greenlit.(tld)/212
//
// Decisions beyond the spec (documented in the WS6 report):
// - Loss: the header take reads `X/10` (as Wordle does), every row is prefixed 🎬, and the line
//   `🔴 SENT TO TURNAROUND` follows the rows, before the link.
// - Vault plays use the same header (`Reel n`) and link to `/vault/n`.
// - Pitches have no reel: header `<APP> · Pitch · Take ...`, link `/p/<slug>` (the slug is opaque).
import { APP_NAME, COPY, SITE_URL, shareHost } from '@/config/brand';
import { RULES } from '@/config/rules';
import { gridFromInput, SHARE_COLUMNS, type ShareCell, type ShareGrid } from './shareGrid';
import type { ShareInput } from './types';

export const SQUARE: Record<ShareCell, string> = { match: '🟩', close: '🟨', miss: '⬛' };
export const ROW_MARK = { take: '🎬', win: '🟢', loss: '🔴', notes: '📝' } as const;

/** "Take 4/<max>", or "Take X/<max>" for a loss. */
export function takeLabel(grid: Pick<ShareGrid, 'rows' | 'status'>): string {
  const take = grid.status === 'won' ? String(grid.rows.length) : 'X';
  return `Take ${take}/${RULES.maxGuesses}`;
}

/** "Reel 212", or "Pitch" for custom challenges. */
export function reelLabel(grid: Pick<ShareGrid, 'kind' | 'reelNumber'>): string {
  return grid.kind === 'pitch' || grid.reelNumber === null ? 'Pitch' : `Reel ${grid.reelNumber}`;
}

export function shareHeader(grid: ShareGrid): string {
  const head = `${APP_NAME} · ${reelLabel(grid)} · ${takeLabel(grid)}`;
  return grid.hintsUsed ? `${head} ${ROW_MARK.notes}` : head;
}

/** Path of the shared puzzle: `/212` for dailies, `/vault/212`, `/p/<slug>`. */
export function sharePath(input: Pick<ShareInput, 'kind' | 'ref' | 'reelNumber'>): string {
  if (input.kind === 'pitch') return `/p/${encodeURIComponent(input.ref)}`;
  const n = input.reelNumber ?? input.ref;
  return input.kind === 'vault' ? `/vault/${n}` : `/${n}`;
}

/** Absolute URL of the shared puzzle (for navigator.share and links). */
export function shareUrl(input: Pick<ShareInput, 'kind' | 'ref' | 'reelNumber'>): string {
  return `${SITE_URL.replace(/\/$/, '')}${sharePath(input)}`;
}

/** The rows and loss line, without header or link. */
export function shareGridLines(grid: ShareGrid): string[] {
  const lines = grid.rows.map((row, i) => {
    const winning = grid.status === 'won' && i === grid.rows.length - 1;
    return `${winning ? ROW_MARK.win : ROW_MARK.take} ${row.map((c) => SQUARE[c]).join('')}`;
  });
  if (grid.status === 'lost') lines.push(`${ROW_MARK.loss} ${COPY.lossStamp}`);
  return lines;
}

/** Share text without the trailing link line (navigator.share passes the url separately). */
export function buildShareBody(input: ShareInput): string {
  const grid = gridFromInput(input);
  return [shareHeader(grid), ...shareGridLines(grid)].join('\n');
}

/** The full share text, exactly as Section 7.1. */
export function buildShareText(input: ShareInput): string {
  return `${buildShareBody(input)}\n${shareHost()}${sharePath(input)}`;
}

const sentenceCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

const CELL_WORD:Record<ShareCell, string> = { match: 'match', close: 'close', miss: 'no match' };

/** Plain-language version of the grid for screen readers (emoji squares read poorly). */
export function describeShare(input: ShareInput): string {
  const grid = gridFromInput(input);
  const takes = grid.rows.length;
  const outcome =
    grid.status === 'won'
      ? `Won in ${takes} of ${RULES.maxGuesses} takes`
      : `${sentenceCase(COPY.lossStamp)} after ${takes} of ${RULES.maxGuesses} takes`;
  const parts = [`${APP_NAME} ${reelLabel(grid)}. ${outcome}${grid.hintsUsed ? ', with Script Notes' : ''}.`];
  grid.rows.forEach((row, i) => {
    const cells = row.map((c, j) => `${SHARE_COLUMNS[j]} ${CELL_WORD[c]}`).join(', ');
    parts.push(`Take ${i + 1}: ${cells}.`);
  });
  return parts.join(' ');
}
