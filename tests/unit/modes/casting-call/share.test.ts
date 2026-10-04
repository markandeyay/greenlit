// Casting Call share line (WS9 rule 8).
import { describe, expect, it } from 'vitest';
import { APP_NAME } from '@/config/brand';
import { castingShareHeader, castingShareText, shortDay } from '@/components/modes/casting-call/shareText';

describe('casting call share text', () => {
  it('matches the spec line for a win', () => {
    expect(castingShareHeader({ date: '2026-10-04', status: 'won', films: 3, optimal: 2 })).toBe(
      `${APP_NAME} · Casting Call · Oct 4 · 3 films (optimal 2)`,
    );
  });

  it('appends the mode URL and uses singular for one film', () => {
    const text = castingShareText({ date: '2026-01-15', status: 'won', films: 1, optimal: 1 }, 'https://example.test/');
    expect(text).toBe(`${APP_NAME} · Casting Call · Jan 15 · 1 film (optimal 1)\nhttps://example.test/modes/casting-call`);
  });

  it('says no connection on a loss and never contains an em dash', () => {
    const text = castingShareText({ date: '2026-10-04', status: 'lost', films: 6, optimal: 2 });
    expect(text).toContain('No connection (optimal 2)');
    expect(text).not.toContain('—');
  });

  it('formats short days', () => {
    expect(shortDay('2026-12-31')).toBe('Dec 31');
    expect(shortDay('bad')).toBe('bad');
  });
});
