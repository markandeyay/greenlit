// Casting Call share line and artifact (WS9 rule 8, design brief v2 principle 8).
import { describe, expect, it } from 'vitest';
import { APP_NAME } from '@/config/brand';
import {
  castingShareArtifact,
  castingShareHeader,
  castingShareRow,
  castingShareText,
  shortDay,
} from '@/components/modes/casting-call/shareText';

describe('casting call share text', () => {
  it('matches the spec line for a win', () => {
    expect(castingShareHeader({ date: '2026-10-04', status: 'won', films: 3, optimal: 2 })).toBe(
      `${APP_NAME} · Casting Call · Oct 4 · 3 films (optimal 2)`,
    );
  });

  it('adds the verdict row and the mode URL, singular for one film', () => {
    const text = castingShareText({ date: '2026-01-15', status: 'won', films: 1, optimal: 1 }, 'https://example.test/');
    expect(text).toBe(`${APP_NAME} · Casting Call · Jan 15 · 1 film (optimal 1)\n🟩\nhttps://example.test/modes/casting-call`);
  });

  it('marks films over the optimal chain as close', () => {
    const text = castingShareText({ date: '2026-10-04', status: 'won', films: 4, optimal: 2 }, 'https://x.test');
    expect(text.split('\n')[1]).toBe('🟩🟩🟨🟨');
  });

  it('says no connection on a loss and never contains an em dash', () => {
    const text = castingShareText({ date: '2026-10-04', status: 'lost', films: 6, optimal: 2 });
    expect(text).toContain('No connection (optimal 2)');
    expect(text.split('\n')[1]).toBe('⬛'.repeat(6));
    expect(text).not.toContain('—');
  });

  it('formats short days', () => {
    expect(shortDay('2026-12-31')).toBe('Dec 31');
    expect(shortDay('bad')).toBe('bad');
  });
});

describe('casting call share artifact', () => {
  it('a perfect chain is all match cells', () => {
    const a = castingShareArtifact({ date: '2026-10-04', status: 'won', films: 2, optimal: 2 }, 'https://x.test');
    expect(a).toMatchObject({ mode: 'casting_call', reelNumber: null, outcome: 'won', stat: '2 films', statCaption: 'optimal 2' });
    expect(a.grid).toEqual([['match', 'match']]);
    expect(a.url).toBe('https://x.test/modes/casting-call');
  });

  it('a loss is X with one miss per film used, at least one', () => {
    const a = castingShareArtifact({ date: '2026-10-04', status: 'lost', films: 0, optimal: 3 });
    expect(a.outcome).toBe('lost');
    expect(a.stat).toBe('X');
    expect(a.grid).toEqual([['miss']]);
    expect(castingShareRow({ status: 'lost', films: 2, optimal: 3 })).toEqual(['miss', 'miss']);
  });

  it('carries only counts (fits the contract limits)', () => {
    const a = castingShareArtifact({ date: '2026-10-04', status: 'won', films: 6, optimal: 3 });
    expect(a.stat.length).toBeLessThanOrEqual(12);
    expect(a.statCaption.length).toBeLessThanOrEqual(24);
    expect(a.grid[0]).toEqual(['match', 'match', 'match', 'close', 'close', 'close']);
    expect(Object.keys(a).sort()).toEqual(['date', 'grid', 'mode', 'outcome', 'reelNumber', 'stat', 'statCaption', 'text', 'url']);
  });
});
