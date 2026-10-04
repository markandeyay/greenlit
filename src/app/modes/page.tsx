import type { Metadata } from 'next';
import Link from 'next/link';
import { APP_NAME } from '@/config/brand';
import { LATER_MODES, MODES } from '@/config/modes';
import { Breadcrumb } from '@/components/chrome/Breadcrumb';
import { SceneHeading } from '@/components/chrome/SceneHeading';
import { Accent, AccentText } from '@/components/ui/Heading';
import { Tag } from '@/components/ui/Tag';

export const metadata: Metadata = {
  title: 'Modes',
  description: `More ways to play ${APP_NAME}.`,
};

const pad2 = (n: number) => String(n).padStart(2, '0');

/** The multiplex: every live mode is a screen you can walk into; later modes are still being fitted. */
export default function ModesPage() {
  const live = MODES.filter((m) => m.status === 'live');
  const later = [
    ...MODES.filter((m) => m.status === 'later').map((m) => ({
      name: m.name,
      pitch: m.pitch,
      phase: m.phase,
      laterReason: m.laterReason ?? 'Still in development.',
    })),
    ...LATER_MODES,
  ];

  return (
    <main className="l-page gl-page">
      <Breadcrumb items={[{ label: APP_NAME, href: '/' }, { label: 'Modes' }]} />
      <div className="mt-10">
        <SceneHeading
          n={1}
          as="h1"
          size="lg"
          slug="INT. THE MULTIPLEX - DAY"
          title={
            <>
              The <Accent>modes</Accent>
            </>
          }
          meta={`${live.length} screens showing today. Pick one and roll.`}
        />
      </div>

      <section aria-labelledby="now-showing" className="mt-12">
        <h2 id="now-showing" className="ty-label">
          Now showing
        </h2>
        <ul className="gl-hub mt-4">
          {live.map((m, i) => (
            <li key={m.id}>
              <Link href={m.href} className="gl-hub__card">
                <span className="gl-hub__top">
                  <span className="ty-label">Screen {pad2(i + 1)}</span>
                  <Tag tone="solid">Phase {m.phase}</Tag>
                </span>
                <span className="gl-hub__title ty-display">
                  <AccentText text={m.accentTitle} />
                </span>
                <span className="gl-hub__pitch">{m.pitch}</span>
                <span className="gl-hub__cta">
                  {m.id === 'classic' ? "Play today's reel" : `Play ${m.name}`}
                  <span aria-hidden="true"> ▸</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {later.length > 0 ? (
        <section aria-labelledby="coming-later" className="mt-14">
          <h2 id="coming-later" className="ty-label">
            Coming later
          </h2>
          <ul className="gl-hub gl-hub--later mt-4">
            {later.map((m) => (
              <li key={m.name} className="gl-hub__card gl-hub__card--later">
                <span className="gl-hub__top">
                  <span className="ty-label">In development</span>
                  <Tag tone="dim">Phase {m.phase}</Tag>
                </span>
                <h3 className="gl-hub__title ty-display">{m.name}</h3>
                <p className="gl-hub__pitch">{m.pitch}</p>
                <p className="gl-hub__why">
                  <span className="ty-label">Why not yet</span> {m.laterReason}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="also-on-the-lot" className="mt-14">
        <h2 id="also-on-the-lot" className="ty-label">
          Also on the lot
        </h2>
        <ul className="gl-hub__lot mt-4">
          <li>
            <Link href="/vault">The Vault: replay any past reel</Link>
          </li>
          <li>
            <Link href="/pitch">Pitch a film to a friend</Link>
          </li>
        </ul>
      </section>
    </main>
  );
}
