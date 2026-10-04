import type { Metadata } from 'next';
import { APP_NAME } from '@/config/brand';
import { PageHeader } from '@/components/chrome/PageHeader';
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
    <main className="l-page gl-page max-w-[720px]!">
      <PageHeader title="Settings" lede="Changes apply instantly." />

      <section className="gl-section mt-8" aria-labelledby="settings-game">
        <h2 id="settings-game" className="gl-h2">
          Game
        </h2>
        <div className="gl-section__body">
          <PreferenceSettings />
        </div>
      </section>

      <section className="gl-section" aria-labelledby="settings-account">
        <h2 id="settings-account" className="gl-h2">
          Account
        </h2>
        <div className="gl-section__body gl-group gl-group__row">
          <AccountPanel authConfigured={authConfigured} />
        </div>
      </section>

      <section className="gl-section" aria-labelledby="settings-privacy">
        <h2 id="settings-privacy" className="gl-h2">
          Privacy
        </h2>
        <div className="gl-section__body">
          <PrivacyNote />
        </div>
      </section>
    </main>
  );
}
