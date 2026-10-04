import Link from 'next/link';
import { APP_NAME, COPY } from '@/config/brand';
import { RESET_TIMEZONE } from '@/config/game';
import { RULES } from '@/config/rules';
import { Accent } from '@/components/ui/Heading';
import { EndCredits } from './EndCredits';
import { LeaderStrip } from './LeaderStrip';
import { TmdbAttribution } from './TmdbAttribution';

const FOOTER_LINKS = [
  { href: '/how-to-play', label: 'How to play' },
  { href: '/vault', label: 'The Vault' },
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
  'Privacy: an anonymous cookie keeps your takes together on this device. Accounts are optional. No ads, no third-party ad trackers, privacy-friendly analytics only.';

/** End credits footer: THE END bracketed by tail leader, a short roll, links, TMDB attribution. */
export function Footer() {
  const { end, credit } = splitEndCredits();
  const [first, ...rest] = end.split(' ');
  return (
    <footer className="gl-footer">
      <LeaderStrip kind="tail" />
      <div className="gl-footer__inner">
        <div className="gl-footer__end">
          <p className="gl-footer__big">
            {rest.length > 0 ? (
              <>
                <Accent>{first}</Accent> {rest.join(' ')}
              </>
            ) : (
              end
            )}
          </p>
          {credit ? <p className="gl-footer__sub">{credit}</p> : null}
        </div>

        <EndCredits
          className="gl-footer__credits"
          rows={[
            { role: 'Takes per reel', name: String(RULES.maxGuesses) },
            { role: 'New reel', name: `Midnight, ${resetCityLabel()}` },
            { role: 'Film data', name: 'TMDB' },
            { role: 'Ads', name: 'None' },
          ]}
        />

        <nav aria-label="Footer">
          <ul className="gl-footer__links">
            {FOOTER_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href}>{l.label}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <TmdbAttribution />

        <p className="gl-footer__fine">{PRIVACY_NOTE}</p>
        <p className="gl-footer__fine" aria-hidden="true">
          {APP_NAME} · 24 fps · 2.39 : 1
        </p>
      </div>
      <LeaderStrip kind="tail" left={<>Tail ▸ {APP_NAME}</>} right="Run out" />
    </footer>
  );
}
