// Release Order share text (WS9, Section 7). Verdict squares only: no titles, dates or order.
//
//   Greenlit · Release Order · Oct 4 · 2/3
//   🟨⬛🟩🟨⬛
//   🟩🟩🟩🟩🟩
//   greenlit.example/modes/release-order
//
// A loss reads X/3 (as the classic share does). 🟨 marks a film one slot off.
import { APP_NAME, SITE_URL, shareHost } from '@/config/brand';
import type { ReleaseOrderState, SlotVerdict } from '@/server/modes/release-order/types';

export const RELEASE_ORDER_PATH = '/modes/release-order';
export const SLOT_SQUARE: Record<SlotVerdict, string> = { match: '🟩', close: '🟨', miss: '⬛' };

type ShareState = Pick<ReleaseOrderState, 'dateLabel' | 'attempts' | 'maxAttempts' | 'status'>;

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
