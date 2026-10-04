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
    <div className="gl-sheet__scroll" role="region" aria-label="What we store" tabIndex={0}>
      <table className="gl-sheet">
        <caption>What we store and why</caption>
        <thead>
          <tr>
            <th scope="col">Item</th>
            <th scope="col">Why</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => (
            <tr key={r.what}>
              <th scope="row" className="whitespace-normal!">
                {r.what}
              </th>
              <td>{r.why}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
