// Navigation map (Section 3). Labels are UI copy; routes are the information architecture.
import { COPY } from '@/config/brand';

export interface NavItem {
  href: string;
  label: string;
}

/** Top bar, in order: Today, Vault, Modes, Leaderboard. */
export const NAV_PRIMARY: readonly NavItem[] = [
  { href: '/', label: 'Today' },
  { href: '/vault', label: 'Vault' },
  { href: '/modes', label: 'Modes' },
  { href: '/leaderboard', label: 'Leaderboard' },
];

/** Utility links (icon buttons on desktop, menu rows on mobile). */
export const NAV_UTILITY: readonly NavItem[] = [
  { href: '/how-to-play', label: 'How to play' },
  { href: '/stats', label: 'Stats' },
  { href: '/settings', label: 'Settings' },
];

/** The slate-shaped call to action. */
export const NAV_PITCH: NavItem = { href: '/pitch', label: COPY.pitchCta };

/** Active when the path is the item or below it. "/" is active only on "/" exactly. */
export function isActivePath(pathname: string | null | undefined, href: string): boolean {
  if (!pathname) return false;
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}
