// Privacy note (Section 15): anon cookie, optional account, privacy-friendly analytics, no ad trackers.
import { ANON_COOKIE, STORAGE_KEYS } from '@/config/game';
import { REGION_COOKIE } from '@/config/regions';

const ROWS: Array<{ what: string; why: string }> = [
  {
    what: `Anonymous cookie (${ANON_COOKIE})`,
    why: 'A random id that keeps your takes together on this device. No name, no email.',
  },
  { what: `Region cookie (${REGION_COOKIE})`, why: 'Only set if you pick a ratings region above.' },
  {
    what: `This device (${STORAGE_KEYS.localStats}, ${STORAGE_KEYS.settings})`,
    why: 'Your results and settings, stored in your browser. Clearing site data resets them.',
  },
  {
    what: 'Account (optional)',
    why: 'Your email or sign-in provider, a handle if you pick one, and your results. Never the films you guessed on a board.',
  },
  { what: 'Analytics', why: 'Privacy-friendly, aggregate only. No third-party ad trackers and no ads.' },
];

export function PrivacyNote() {
  return (
    <dl className="gl-kv gl-group" aria-label="What we store and why">
      {ROWS.map((r) => (
        <div key={r.what} className="gl-group__row">
          <dt>{r.what}</dt>
          <dd>{r.why}</dd>
        </div>
      ))}
    </dl>
  );
}
