import { describe, expect, it } from 'vitest';
import { APP_NAME, shareHost } from '@/config/brand';
import { RULES } from '@/config/rules';
import { buildShareText, sharePath, shareUrl } from '@/components/share/shareText';
import { decodeShareGrid, encodeShareGrid, gridFromInput } from '@/components/share/shareGrid';
import type { ShareInput } from '@/components/share/types';
import { fb } from '../../share/fixtures';

const REF = 'Zq3_opaqueReelRefThatMustNeverBeShared-xyz';

const input = (over: Partial<ShareInput> = {}): ShareInput => ({
  kind: 'unlimited',
  ref: REF,
  reelNumber: null,
  feedback: [fb('bbbgybgb'), fb('gggggggg', { correct: true })],
  status: 'won',
  hintsUsed: 0,
  ...over,
});

describe('Dailies Reel share', () => {
  it('uses the Dailies Reel header and the mode URL, never the ref', () => {
    const text = buildShareText(input());
    expect(text).toBe(
      [`${APP_NAME} · Dailies Reel · Take 2/${RULES.maxGuesses}`, '🎬 ⬛⬛⬛🟩🟨⬛🟩⬛', '🟢 🟩🟩🟩🟩🟩🟩🟩🟩', `${shareHost()}/modes/unlimited`].join('\n'),
    );
    expect(text).not.toContain(REF);
    expect(sharePath(input())).toBe('/modes/unlimited');
    expect(shareUrl(input())).toMatch(/\/modes\/unlimited$/);
  });

  it('marks notes and losses like the daily', () => {
    const text = buildShareText(input({ status: 'lost', feedback: [fb('bbbbbbbb')], hintsUsed: 1 }));
    expect(text.split('\n')[0]).toBe(`${APP_NAME} · Dailies Reel · Take X/${RULES.maxGuesses} 📝`);
  });

  it('the share image query round trips without a reel number', () => {
    const qs = encodeShareGrid(input({ reelNumber: 5 }));
    expect(qs).toContain('k=u');
    expect(qs).not.toContain('n=');
    expect(qs).not.toContain(REF);
    const decoded = decodeShareGrid(new URLSearchParams(qs));
    expect(decoded).toEqual({ ok: true, grid: gridFromInput(input()) });
    expect(decodeShareGrid(new URLSearchParams(`${qs}&n=4`)).ok).toBe(false);
  });
});
