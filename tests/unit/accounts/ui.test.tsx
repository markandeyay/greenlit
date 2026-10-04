// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS } from '@/config/game';
import { REGION_COOKIE } from '@/config/regions';
import { RULES } from '@/config/rules';
import { __resetSettingsCacheForTests, readSettings } from '@/lib/settings';
import { recordLocalPlay } from '@/lib/local-stats';
import { AccountPanel } from '@/components/account/AccountPanel';
import { PreferenceSettings } from '@/components/account/PreferenceSettings';
import { regionCookieString, readRegionCookie } from '@/components/account/region-cookie';
import { __resetMeForTests } from '@/components/account/useMe';
import type { MeResponse } from '@/components/account/types';
import { StatsView } from '@/components/stats/StatsView';
import { LeaderboardView } from '@/components/leaderboard/LeaderboardView';

const KEYLESS_ME: MeResponse = { authConfigured: false, user: null, profile: null, boardName: null, stats: null };

function mockFetch(routes: Record<string, unknown>) {
  const fn = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const key = Object.keys(routes).find((k) => url.startsWith(k));
    return new Response(JSON.stringify(key ? routes[key] : {}), { status: key ? 200 : 404 });
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

function clearCookies() {
  for (const c of document.cookie.split(';')) {
    const name = c.split('=')[0]?.trim();
    if (name) document.cookie = `${name}=; Path=/; Max-Age=0`;
  }
}

beforeEach(() => {
  localStorage.clear();
  clearCookies();
  __resetSettingsCacheForTests();
  __resetMeForTests();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('region cookie', () => {
  it('builds a plain one-year SameSite=Lax cookie, and clears it for Auto', () => {
    expect(regionCookieString('GB', false)).toBe(`${REGION_COOKIE}=GB; Path=/; Max-Age=31536000; SameSite=Lax`);
    expect(regionCookieString('GB', true)).toMatch(/; Secure$/);
    expect(regionCookieString(null, false)).toBe(`${REGION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`);
    expect(regionCookieString('GB', false)).not.toMatch(/HttpOnly/i);
  });
});

describe('settings', () => {
  it('writes the region cookie and ClientSettings when a region is picked', async () => {
    mockFetch({ '/api/me': KEYLESS_ME });
    const user = userEvent.setup();
    render(<PreferenceSettings />);
    await user.click(screen.getByRole('radio', { name: /UK/ }));
    expect(readRegionCookie()).toBe('GB');
    expect(readSettings().region).toBe('GB');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.settings)!).region).toBe('GB');
    expect(screen.getByRole('radio', { name: /UK/ })).toBeChecked();

    await user.click(screen.getByRole('radio', { name: /Auto/ }));
    expect(readRegionCookie()).toBeNull();
    expect(readSettings().region).toBeNull();
  });

  it('toggles colorblind mode and motion instantly', async () => {
    mockFetch({ '/api/me': KEYLESS_ME });
    const user = userEvent.setup();
    render(<PreferenceSettings />);
    await user.click(screen.getByRole('switch', { name: /Colorblind mode/ }));
    expect(document.documentElement.getAttribute('data-colorblind')).toBe('true');
    await user.click(screen.getByRole('radio', { name: /Reduce/ }));
    expect(document.documentElement.getAttribute('data-reduced-motion')).toBe('on');
    expect(readSettings()).toMatchObject({ colorblind: true, reducedMotion: 'on' });
  });

  it('shows "accounts open soon" in keyless mode instead of sign-in', () => {
    mockFetch({ '/api/me': KEYLESS_ME });
    render(<AccountPanel authConfigured={false} />);
    expect(screen.getByText(/Accounts open soon/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Google/ })).toBeNull();
  });

  it('shows sign-in options when configured and signed out', async () => {
    mockFetch({ '/api/me': { ...KEYLESS_ME, authConfigured: true } });
    render(<AccountPanel authConfigured />);
    expect(await screen.findByRole('button', { name: /Continue with Google/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continue with X/ })).toBeInTheDocument();
    expect(screen.getByLabelText(/magic link/)).toBeInTheDocument();
  });

  it('shows handle and sign out when signed in', async () => {
    mockFetch({
      '/api/me': {
        authConfigured: true,
        user: { id: 'u1', email: 'a@x.com', isAdmin: false },
        profile: { handle: null, region: null },
        boardName: 'Extra #ABCD',
        stats: null,
      } satisfies MeResponse,
    });
    const user = userEvent.setup();
    render(<AccountPanel authConfigured />);
    expect(await screen.findByText('a@x.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign out/ })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Handle'), 'no spaces');
    await user.click(screen.getByRole('button', { name: /Save handle/ }));
    expect(screen.getByText(/Letters, numbers and underscores only/)).toBeInTheDocument();
  });
});

describe('stats page', () => {
  it('renders local stats with takes 1 to 10 plus turnaround, and vault separately', async () => {
    mockFetch({ '/api/me': KEYLESS_ME });
    recordLocalPlay({ kind: 'daily', ref: '1', status: 'won', takes: 3, hintsUsed: 1, finishedAt: '2026-10-01T12:00:00Z' });
    recordLocalPlay({ kind: 'daily', ref: '2', status: 'lost', takes: 10, hintsUsed: 0, finishedAt: '2026-10-02T12:00:00Z' });
    recordLocalPlay({ kind: 'vault', ref: '1', status: 'won', takes: 6, hintsUsed: 0, finishedAt: '2026-10-03T12:00:00Z' });
    await act(async () => {
      render(<StatsView />);
    });
    const table = screen.getByRole('table', { name: /Take distribution/ });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(RULES.maxGuesses + 1);
    expect(within(rows[2]!).getByRole('rowheader')).toHaveTextContent('Take 3');
    expect(within(rows[2]!).getByText('1')).toBeInTheDocument();
    expect(within(rows[RULES.maxGuesses]!).getByText('Sent to turnaround')).toBeInTheDocument();
    expect(within(rows[RULES.maxGuesses]!).getByText('1')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'The Vault' })).toBeInTheDocument();
  });
});

describe('leaderboard page', () => {
  it('shows a tasteful empty state in keyless mode', async () => {
    mockFetch({ '/api/me': KEYLESS_ME, '/api/leaderboard': { period: 'week', noNotes: false, rows: [] } });
    render(<LeaderboardView authConfigured={false} />);
    expect(await screen.findByText(/The credits are blank/)).toBeInTheDocument();
    expect(screen.getByText(/Accounts open soon/)).toBeInTheDocument();
  });

  it('highlights the signed-in player and refetches with the no-notes filter', async () => {
    const fetchMock = mockFetch({
      '/api/me': {
        authConfigured: true,
        user: { id: 'u1', email: null, isAdmin: false },
        profile: { handle: 'bob', region: null },
        boardName: 'bob',
        stats: null,
      } satisfies MeResponse,
      '/api/leaderboard': {
        period: 'week',
        noNotes: false,
        rows: [
          { rank: 1, handle: 'alice', value: 3, played: 3, wins: 3 },
          { rank: 2, handle: 'bob', value: 4.33, played: 3, wins: 2 },
        ],
      },
    });
    const user = userEvent.setup();
    render(<LeaderboardView authConfigured />);
    const bobRow = (await screen.findByText('bob')).closest('tr')!;
    await screen.findByText('You');
    expect(bobRow).toHaveAttribute('aria-current', 'true');
    expect(within(bobRow).getByText('You')).toBeInTheDocument();
    expect(within(bobRow).getByText('4.33')).toBeInTheDocument();

    await user.click(screen.getByRole('switch', { name: /No notes/ }));
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('noNotes=true'))).toBe(true);
    await user.click(screen.getByRole('tab', { name: 'Streaks' }));
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('period=streak'))).toBe(true);
  });
});
