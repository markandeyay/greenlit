// @vitest-environment jsdom
import { act, fireEvent, render, screen, cleanup, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS } from '@/config/game';
import { dateInResetZone } from '@/lib/dates';
import { __resetSettingsCacheForTests } from '@/lib/settings';
import { Leader, __resetLeaderForTests, replayLeader, shouldPlayLeader } from '@/components/chrome/Leader';

afterEach(cleanup);

function mockMatchMedia(reduce: boolean) {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: q.includes('prefers-reduced-motion') ? reduce : false,
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  localStorage.clear();
  __resetLeaderForTests();
  __resetSettingsCacheForTests();
  mockMatchMedia(false);
});
afterEach(() => vi.restoreAllMocks());

describe('shouldPlayLeader', () => {
  it('plays once per New York day and never under reduced motion', () => {
    expect(shouldPlayLeader({ seen: null, today: '2026-10-04', reducedMotion: false })).toBe(true);
    expect(shouldPlayLeader({ seen: '2026-10-03', today: '2026-10-04', reducedMotion: false })).toBe(true);
    expect(shouldPlayLeader({ seen: '2026-10-04', today: '2026-10-04', reducedMotion: false })).toBe(false);
    expect(shouldPlayLeader({ seen: null, today: '2026-10-04', reducedMotion: true })).toBe(false);
  });
});

describe('<Leader>', () => {
  it('plays on the first visit of the day, is aria-hidden, and records the date', async () => {
    render(<Leader />);
    const el = await screen.findByTestId('leader');
    expect(el).toHaveAttribute('aria-hidden', 'true');
    expect(localStorage.getItem(STORAGE_KEYS.leaderSeen)).toBe(dateInResetZone());
    // Nothing inside is reachable by Tab.
    el.querySelectorAll('button').forEach((b) => expect(b).toHaveAttribute('tabindex', '-1'));
  });

  it('any key skips it', async () => {
    render(<Leader />);
    await screen.findByTestId('leader');
    // The key listener is attached in a passive effect after the overlay commits; under full-suite
    // load that effect can land a tick after findByTestId resolves. Retry the key press until the
    // listener is live (each press is a fresh key), with a budget well under the 1.2s auto-finish
    // so the test proves the key skipped it rather than the countdown ending on its own.
    await waitFor(
      () => {
        act(() => {
          fireEvent.keyDown(window, { key: 'Tab' });
        });
        expect(screen.queryByTestId('leader')).toBeNull();
      },
      { timeout: 600, interval: 10 },
    );
  });

  it('a click skips it', async () => {
    render(<Leader />);
    fireEvent.click(await screen.findByTestId('leader'));
    expect(screen.queryByTestId('leader')).toBeNull();
  });

  it('does not play again the same day', async () => {
    localStorage.setItem(STORAGE_KEYS.leaderSeen, dateInResetZone());
    render(<Leader />);
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId('leader')).toBeNull();
  });

  it('never plays under reduced motion, even on replay', async () => {
    mockMatchMedia(true);
    render(<Leader />);
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId('leader')).toBeNull();
    act(() => replayLeader());
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId('leader')).toBeNull();
  });

  it('can be replayed', async () => {
    localStorage.setItem(STORAGE_KEYS.leaderSeen, dateInResetZone());
    render(<Leader />);
    act(() => replayLeader());
    expect(await screen.findByTestId('leader')).toBeInTheDocument();
  });

  it('finishes on its own in about 1.2s', async () => {
    render(<Leader />);
    await screen.findByTestId('leader');
    await new Promise((r) => setTimeout(r, 1600));
    expect(screen.queryByTestId('leader')).toBeNull();
  });
});
