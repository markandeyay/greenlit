import Link from 'next/link';
import { COPY } from '@/config/brand';
import { RESET_TIMEZONE } from '@/config/game';
import { TmdbAttribution } from './TmdbAttribution';

const FOOTER_LINKS = [
  { href: '/how-to-play', label: 'How to play' },
  { href: '/vault', label: 'Vault' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/stats', label: 'Stats' },
  { href: '/settings', label: 'Settings' },
] as const;

/** "America/New_York" -> "New York". */
export function resetCityLabel(tz: string = RESET_TIMEZONE): string {
  return (tz.split('/').pop() ?? tz).replace(/_/g, ' ');
}

/** Split COPY.endCredits ("The End · A ... production") into the card word and the credit line. */
export function splitEndCredits(text: string = COPY.endCredits): { end: string; credit: string } {
  const i = text.indexOf(' · ');
  return i < 0 ? { end: text, credit: '' } : { end: text.slice(0, i), credit: text.slice(i + 3) };
}

export const PRIVACY_NOTE =
  'No ads and no ad trackers. An anonymous cookie keeps your takes on this device; accounts are optional.';

/**
 * The slim footer: the utility links, the required TMDB attribution
 * (Section 15) and one privacy line.
 */
export function Footer() {
  return (
    <footer className="gl-footer">
      <div className="gl-footer__inner">
        <div className="gl-footer__row">
          <nav aria-label="Footer">
            <ul className="gl-footer__links">
              {FOOTER_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href}>{l.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="gl-footer__row gl-footer__row--fine">
          <TmdbAttribution />
          <p className="gl-footer__fine">{PRIVACY_NOTE}</p>
        </div>
      </div>
    </footer>
  );
}
