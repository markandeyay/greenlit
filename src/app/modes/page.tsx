import type { Metadata } from 'next';
import Link from 'next/link';
import { APP_NAME } from '@/config/brand';
import { Breadcrumb } from '@/components/chrome/Breadcrumb';
import { SceneHeading } from '@/components/chrome/SceneHeading';
import { Accent } from '@/components/ui/Heading';
import { Tag } from '@/components/ui/Tag';

export const metadata: Metadata = {
  title: 'Modes',
  description: `More ways to play ${APP_NAME}.`,
};

interface Mode {
  name: string;
  phase: 1 | 2 | 3;
  pitch: string;
  href?: string;
}

/** Section 5. Phase 1 modes link to their live routes; later phases are listed as coming soon. */
const MODES: Mode[] = [
  { name: 'Classic', phase: 1, pitch: 'Deduce the film. The daily reel.', href: '/' },
  { name: 'The Vault', phase: 1, pitch: 'Play past dailies.', href: '/vault' },
  { name: 'Pitch', phase: 1, pitch: 'Pick a film, challenge a friend.', href: '/pitch' },
  { name: 'Dailies Reel', phase: 2, pitch: 'Endless practice from a difficulty band.' },
  { name: 'Opening Weekend', phase: 2, pitch: 'Two posters. Which grossed more?' },
  { name: 'Release Order', phase: 2, pitch: 'Sort five films by release date.' },
  { name: 'Themed weeks', phase: 2, pitch: 'Curated runs of daily reels.' },
  { name: 'Casting Call', phase: 3, pitch: 'Connect two actors through shared films.' },
  { name: 'Logline', phase: 3, pitch: 'Guess from a one-line synopsis.' },
  { name: 'Double Feature', phase: 3, pitch: 'Live one on one. Same film, race.' },
  { name: 'Frame Lock', phase: 3, pitch: 'Guess from stills, once the rights are clear.' },
];

const PHASE_LABEL: Record<Mode['phase'], string> = {
  1: 'Now showing',
  2: 'Coming soon',
  3: 'In development',
};

export default function ModesPage() {
  return (
    <main className="l-page gl-page">
      <Breadcrumb items={[{ label: APP_NAME, href: '/' }, { label: 'Modes' }]} />
      <div className="mt-10">
        <SceneHeading
          n={1}
          as="h1"
          size="lg"
          slug="INT. THE MULTIPLEX - NIGHT"
          title={
            <>
              The <Accent>modes</Accent>
            </>
          }
          meta="Classic first. More screens are being fitted"
        />
      </div>
      <ul className="mt-12 grid gap-px border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-3">
        {MODES.map((m, i) => {
          const body = (
            <>
              <div className="flex items-center justify-between gap-3">
                <span className="ty-label">Screen {String(i + 1).padStart(2, '0')}</span>
                <Tag tone={m.phase === 1 ? 'solid' : 'dim'}>{PHASE_LABEL[m.phase]}</Tag>
              </div>
              <h2 className="ty-display mt-6 text-[length:var(--t-d3)]">{m.name}</h2>
              <p className="mt-2 text-ink-dim">{m.pitch}</p>
              <p className="ty-label mt-6">Phase {m.phase}</p>
            </>
          );
          return (
            <li key={m.name} className="bg-bg">
              {m.href ? (
                <Link href={m.href} className="block h-full p-5 transition-colors hover:bg-surface">
                  {body}
                </Link>
              ) : (
                <div className="h-full p-5 opacity-80">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
