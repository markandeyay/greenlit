// Navigation map (Section 3). Labels are UI copy; routes are the information architecture.
import { COPY } from '@/config/brand';

export interface NavItem {
  href: string;
  label: string;
  /** 'core' links show in the header from tablet width; 'more' only on desktop (always in the menu). */
  tier?: 'core' | 'more';
}

/** Primary routes, in order: Today, Modes, Vault, Leaderboard. */
export const NAV_PRIMARY: readonly NavItem[] = [
  { href: '/', label: 'Today', tier: 'core' },
  { href: '/modes', label: 'Modes', tier: 'core' },
  { href: '/vault', label: 'Vault', tier: 'more' },
  { href: '/leaderboard', label: 'Leaderboard', tier: 'more' },
];

/** Utility links (icon buttons in the header at every width). */
export const NAV_UTILITY: readonly NavItem[] = [
  { href: '/how-to-play', label: 'How to play' },
  { href: '/stats', label: 'Stats' },
  { href: '/settings', label: 'Settings' },
];

/** The slate-shaped call to action (header on desktop, menu sheet on mobile). */
export const NAV_PITCH: NavItem = { href: '/pitch', label: COPY.pitchCta };

/** Active when the path is the item or below it. "/" is active only on "/" exactly. */
export function isActivePath(pathname: string | null | undefined, href: string): boolean {
  if (!pathname) return false;
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}
