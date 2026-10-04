'use client';

import { UNLIMITED, type UnlimitedBand } from '@/config/modes';
import { cx } from '@/components/ui/cx';
import { BANDS } from './reel-client';

/** One line per band, shown under its chip label. */
export const BAND_BLURB: Record<UnlimitedBand, string> = {
  popular: 'Crowd pleasers',
  cinephile: 'For the regulars',
  deep_cut: 'Hard mode',
};

/**
 * Difficulty band as a native radio group drawn as chips (arrow keys move between options). The
 * selected chip inverts AND shows a check, so state never relies on color alone.
 */
export function BandPicker({
  value,
  onChange,
  legend,
  disabled = false,
  className,
}: {
  value: UnlimitedBand;
  onChange: (band: UnlimitedBand) => void;
  legend: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <fieldset className={cx('grid gap-2', className)} disabled={disabled}>
      <legend className="ty-label mb-2">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {BANDS.map((band) => {
          const checked = band === value;
          return (
            <label
              key={band}
              className="gl-chip cursor-pointer select-none has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-bg has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink"
            >
              <input
                type="radio"
                className="sr-only"
                name="unlimited-band"
                value={band}
                checked={checked}
                onChange={() => onChange(band)}
              />
              <span aria-hidden="true" className="inline-block w-[1ch]">
                {checked ? '✓' : ''}
              </span>
              <span>{UNLIMITED.bands[band].label}</span>
              <span className="font-normal normal-case opacity-75">{BAND_BLURB[band]}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
