import type { Metadata } from 'next';
import { APP_NAME } from '@/config/brand';
import { LAUNCH_DATE } from '@/config/game';
import { Breadcrumb } from '@/components/chrome/Breadcrumb';
import { FilmMicrocopy } from '@/components/chrome/FilmMicrocopy';
import { SceneHeading } from '@/components/chrome/SceneHeading';
import { SlateMeta } from '@/components/chrome/SlateMeta';
import { Accent } from '@/components/ui/Heading';
import { AccountPanel } from '@/components/account/AccountPanel';
import { PreferenceSettings } from '@/components/account/PreferenceSettings';
import { PrivacyNote } from '@/components/account/PrivacyNote';
import { isAuthConfigured } from '@/lib/supabase/config';

export const metadata: Metadata = {
  title: 'Settings',
  description: `Ratings region, colorblind mode, motion and your optional ${APP_NAME} account.`,
};

export default function SettingsPage() {
  const authConfigured = isAuthConfigured();
  return (
    <main className="l-page gl-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Breadcrumb items={[{ label: APP_NAME, href: '/' }, { label: 'Settings' }]} />
        <FilmMicrocopy />
      </div>

      <div className="mt-10">
        <SlateMeta roll={LAUNCH_DATE.slice(0, 4)} scene={0} take={1} extra={['Prep']} decorative />
        <h1 className="ty-display mt-3 text-[length:var(--t-d1)]">
          The <Accent>prep</Accent> room
        </h1>
        <p className="ty-lede mt-5 text-ink-dim">Set up your screening. Every change applies instantly.</p>
      </div>

      <section className="gl-section mt-16" aria-labelledby="settings-screening">
        <SceneHeading
          n={1}
          slug="INT. PROJECTION BOOTH - NIGHT"
          title="The *screening*"
          meta="Region, color and motion"
          id="settings-screening"
        />
        <div className="gl-section__body">
          <PreferenceSettings />
        </div>
      </section>

      <section className="gl-section" aria-labelledby="settings-account">
        <SceneHeading
          n={2}
          slug="INT. CASTING OFFICE - DAY"
          title="Your *billing*"
          meta="Optional account"
          id="settings-account"
        />
        <div className="gl-section__body max-w-2xl">
          <AccountPanel authConfigured={authConfigured} />
        </div>
      </section>

      <section className="gl-section" aria-labelledby="settings-privacy">
        <SceneHeading n={3} slug="EXT. THE BACKLOT - DAY" title="The *fine print*" meta="Privacy" id="settings-privacy" />
        <div className="gl-section__body">
          <PrivacyNote />
        </div>
      </section>
    </main>
  );
}
