// Release Order share text (WS9, Section 7). Verdict squares only: no titles, dates or order.
//
//   Greenlit · Release Order · Oct 4 · 2/3
//   🟨⬛🟩🟨⬛
//   🟩🟩🟩🟩🟩
//   greenlit.example/modes/release-order
//
// A loss reads X/3 (as the classic share does). 🟨 marks a film one slot off.
import { APP_NAME, SITE_URL, shareHost } from '@/config/brand';
import type { ShareArtifact } from '@/components/share/artifact';
import type { ReleaseOrderState, SlotVerdict } from '@/server/modes/release-order/types';

export const RELEASE_ORDER_PATH = '/modes/release-order';
export const SLOT_SQUARE: Record<SlotVerdict, string> = { match: '🟩', close: '🟨', miss: '⬛' };

type ShareState = Pick<ReleaseOrderState, 'dateLabel' | 'attempts' | 'maxAttempts' | 'status'>;
type ArtifactState = ShareState & Pick<ReleaseOrderState, 'date'>;

export function releaseOrderScore(state: ShareState): string {
  const used = state.status === 'won' ? String(state.attempts.length) : 'X';
  return `${used}/${state.maxAttempts}`;
}

export function buildReleaseOrderShare(state: ShareState): string {
  const head = `${APP_NAME} · Release Order · ${state.dateLabel} · ${releaseOrderScore(state)}`;
  const rows = state.attempts.map((a) => a.feedback.map((v) => SLOT_SQUARE[v]).join(''));
  return [head, ...rows, `${shareHost()}${RELEASE_ORDER_PATH}`].join('\n');
}

export function releaseOrderUrl(): string {
  return `${SITE_URL.replace(/\/$/, '')}${RELEASE_ORDER_PATH}`;
}

/**
 * Spoiler-free share artifact for a finished round: "2/3" (or "X/3") takes, one row of five
 * match / close / miss cells per take. No titles, posters or dates.
 */
export function releaseOrderArtifact(state: ArtifactState): ShareArtifact {
  return {
    mode: 'release_order',
    reelNumber: null,
    date: state.date,
    outcome: state.status === 'won' ? 'won' : 'lost',
    stat: releaseOrderScore(state),
    statCaption: 'takes',
    grid: state.attempts.map((a) => [...a.feedback]),
    url: releaseOrderUrl(),
    text: buildReleaseOrderShare(state),
  };
}
