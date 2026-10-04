// @vitest-environment jsdom
import { fireEvent, render, screen, within, cleanup } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import { APP_NAME, COPY, TMDB_ATTRIBUTION } from '@/config/brand';

let pathname = '/';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

import { Nav } from '@/components/chrome/Nav';
import { Footer } from '@/components/chrome/Footer';

afterEach(cleanup);

beforeEach(() => {
  pathname = '/';
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: false,
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
});

describe('<Nav>', () => {
  it('renders the wordmark, the four routes, utilities and the pitch slate', () => {
    render(<Nav />);
    expect(screen.getAllByText(APP_NAME).length).toBeGreaterThan(0);
    const main = screen.getByRole('navigation', { name: 'Main' });
    expect(within(main).getAllByRole('link').map((a) => a.textContent)).toEqual(['Today', 'Vault', 'Modes', 'Leaderboard']);
    expect(screen.getByRole('link', { name: 'How to play' })).toHaveAttribute('href', '/how-to-play');
    expect(screen.getByRole('link', { name: 'Stats' })).toHaveAttribute('href', '/stats');
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings');
    expect(screen.getAllByRole('link', { name: COPY.pitchCta, hidden: true })[0]).toHaveAttribute('href', '/pitch');
    expect(screen.getByRole('timer')).toBeInTheDocument();
  });

  it('marks the active route', () => {
    pathname = '/vault/12';
    render(<Nav />);
    const main = screen.getByRole('navigation', { name: 'Main' });
    expect(within(main).getByRole('link', { name: 'Vault' })).toHaveAttribute('aria-current', 'page');
    expect(within(main).getByRole('link', { name: 'Today' })).not.toHaveAttribute('aria-current');
  });

  it('mobile menu is an accessible disclosure that Escape closes', () => {
    render(<Nav />);
    const burger = screen.getByRole('button', { name: 'Open menu' });
    expect(burger).toHaveAttribute('aria-expanded', 'false');
    const menu = document.getElementById(burger.getAttribute('aria-controls')!)!;
    expect(menu).toHaveAttribute('hidden');
    fireEvent.click(burger);
    expect(burger).toHaveAttribute('aria-expanded', 'true');
    expect(menu).not.toHaveAttribute('hidden');
    expect(within(menu).getByRole('link', { name: /Leaderboard/ })).toBeInTheDocument();
    fireEvent.keyDown(menu, { key: 'Escape' });
    expect(burger).toHaveAttribute('aria-expanded', 'false');
    expect(document.activeElement).toBe(burger);
  });

  it('a menu link closes the menu', () => {
    render(<Nav />);
    const burger = screen.getByRole('button', { name: 'Open menu' });
    fireEvent.click(burger);
    const menu = document.getElementById(burger.getAttribute('aria-controls')!)!;
    fireEvent.click(within(menu).getByRole('link', { name: /Vault/ }));
    expect(burger).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('<Footer>', () => {
  it('shows end credits from COPY and the TMDB attribution', () => {
    render(<Footer />);
    const [end, credit] = COPY.endCredits.split(' · ');
    expect(screen.getByText(credit!)).toBeInTheDocument();
    expect(document.body.textContent).toContain(end!.split(' ').pop()!);
    expect(screen.getByText(TMDB_ATTRIBUTION)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /TMDB/ })).toHaveAttribute('href', 'https://www.themoviedb.org/');
    expect(screen.getByRole('link', { name: 'How to play' })).toBeInTheDocument();
  });
});
