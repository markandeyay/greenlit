import type { Metadata } from 'next';
import Link from 'next/link';
import { APP_NAME } from '@/config/brand';
import { LATER_MODES, MODES, type ModeId } from '@/config/modes';
import { PageHeader } from '@/components/chrome/PageHeader';
import { Accent } from '@/components/ui/Heading';
import { ModeArt } from './mode-art';
import { PlayedToday } from './played-today';

export const metadata: Metadata = {
  title: 'Modes',
  description: `More ways to play ${APP_NAME}.`,
};

/** Modes with one shared puzzle per day; the rest are endless practice. */
const ENDLESS: readonly ModeId[] = ['unlimited'];
const TONES = ['blue', 'warm'] as const;

/** The hub: one card per live mode (art, name, one-line pitch, Play), then what is coming later. */
export default function ModesPage() {
  const live = MODES.filter((m) => m.status === 'live');
  const later = [...MODES.filter((m) => m.status === 'later').map((m) => m.name), ...LATER_MODES.map((m) => m.name)];

  return (
    <main className="l-page gl-page">
      <PageHeader
        title={
          <>
            Game <Accent>modes</Accent>
          </>
        }
        lede="Pick a game. Daily modes reset at midnight, New York time."
      />

      <ul className="gl-modes mt-6" aria-label="Game modes">
        {live.map((m, i) => {
          const daily = !ENDLESS.includes(m.id);
          const featured = m.id === 'classic';
          return (
            <li key={m.id}>
              <Link href={m.href} className="gl-mode" data-featured={featured || undefined}>
                <span className="gl-mode__art" data-tone={featured ? 'navy' : TONES[i % TONES.length]}>
                  <ModeArt mode={m.id} />
                </span>
                <span className="gl-mode__body">
                  <span className="gl-mode__name">{featured ? "Today's reel" : m.name}</span>
                  <span className="gl-mode__pitch">{m.pitch}</span>
                  {daily ? <PlayedToday mode={m.id} /> : null}
                </span>
                <span className="gl-mode__play" aria-hidden="true">
                  Play
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-8 grid gap-2 text-[15px] text-ink-dim">
        {later.length > 0 ? <p>Coming later: {later.join(', ')}.</p> : null}
        <p>
          Want more?{' '}
          <Link href="/vault" className="font-semibold text-accent-ink underline underline-offset-4">
            Replay past reels
          </Link>{' '}
          or{' '}
          <Link href="/pitch" className="font-semibold text-accent-ink underline underline-offset-4">
            pitch a film to a friend
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
