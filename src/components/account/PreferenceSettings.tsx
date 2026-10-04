'use client';
// Region, colorblind mode and reduced motion. Changes apply instantly through useSettings();
// the region also writes REGION_COOKIE (read by the server) and, when signed in, the profile.
import { useEffect } from 'react';
import { REGIONS, REGION_CODES } from '@/config/regions';
import { Switch } from '@/components/ui/Switch';
import { useSettings } from '@/lib/settings';
import type { ClientSettings, RegionCode } from '@/lib/types';
import { RadioChips, type RadioChipOption } from './RadioChips';
import { readRegionCookie, writeRegionCookie } from './region-cookie';
import { useMe } from './useMe';

const AUTO = 'auto';
type RegionChoice = RegionCode | typeof AUTO;

const REGION_OPTIONS: RadioChipOption<RegionChoice>[] = [
  { value: AUTO, label: 'Auto', hint: 'from your browser' },
  ...REGION_CODES.map((code) => ({ value: code, label: REGIONS[code].label, hint: REGIONS[code].board })),
];

const MOTION_OPTIONS: RadioChipOption<ClientSettings['reducedMotion']>[] = [
  { value: 'system', label: 'System', hint: 'follow my device' },
  { value: 'on', label: 'Reduce' },
  { value: 'off', label: 'Full motion' },
];

/** Apply a region choice everywhere it lives. Exported for tests. */
export function applyRegion(
  region: RegionCode | null,
  update: (patch: Partial<ClientSettings>) => void,
  signedIn: boolean,
): void {
  update({ region });
  writeRegionCookie(region);
  if (signedIn) {
    void fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ region }),
    }).catch(() => {});
  }
}

export function PreferenceSettings() {
  const [settings, update] = useSettings();
  const me = useMe();
  const signedIn = Boolean(me.data?.user);

  // Keep the server cookie in step with the stored preference (e.g. after the cookie expired).
  useEffect(() => {
    const cookie = readRegionCookie();
    if ((settings.region ?? null) !== (cookie || null)) writeRegionCookie(settings.region);
  }, [settings.region]);

  const regionName = settings.region ? `${REGIONS[settings.region].name} (${REGIONS[settings.region].board})` : null;

  return (
    <div className="gl-group">
      <div className="gl-group__row grid gap-2">
        <RadioChips<RegionChoice>
          name="region"
          legend="Ratings region"
          description="Which age rating the Rating cell shows, for example PG-13 or 12A. If a film has none there, the US rating is used."
          options={REGION_OPTIONS}
          value={settings.region ?? AUTO}
          onChange={(v) => applyRegion(v === AUTO ? null : v, update, signedIn)}
        />
        <p className="text-sm text-ink-dim" aria-live="polite">
          {regionName ? `Using ${regionName}.` : 'Using your browser language to pick a region.'}
        </p>
      </div>

      <div className="gl-group__row">
      <Switch
        checked={settings.colorblind}
        onChange={(colorblind) => update({ colorblind })}
        label="Colorblind mode"
        description="Swaps green and amber for blue and orange and adds patterns to every cell."
      />
      </div>

      <div className="gl-group__row">
      <RadioChips<ClientSettings['reducedMotion']>
        name="reduced-motion"
        legend="Motion"
        description="Slate claps, cell flips, the countdown leader and the stamp."
        options={MOTION_OPTIONS}
        value={settings.reducedMotion}
        onChange={(reducedMotion) => update({ reducedMotion })}
      />
      </div>
    </div>
  );
}
