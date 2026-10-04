'use client';

import { UNLIMITED, type UnlimitedBand } from '@/config/modes';
import { cx } from '@/components/ui/cx';
import { BANDS } from './reel-client';

/** One line per band, shown under its pill label. */
export const BAND_BLURB: Record<UnlimitedBand, string> = {
  popular: 'Crowd pleasers',
  cinephile: 'For the regulars',
  deep_cut: 'Hard mode',
};

/**
 * Difficulty band as a native radio group drawn as three big pills (arrow keys move between
 * options). The selected pill inverts AND shows a check, so state never relies on color alone.
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
    <fieldset className={cx('m-0 min-w-0 border-0 p-0', className)} disabled={disabled}>
      <legend className="mb-2 p-0 text-[15px] font-semibold">{legend}</legend>
      <div className="grid grid-cols-3 gap-2">
        {BANDS.map((band) => {
          const checked = band === value;
          return (
            <label
              key={band}
              className={cx(
                'flex min-h-[72px] cursor-pointer flex-col items-center justify-center gap-0.5 rounded-[14px] border-2 border-rule bg-surface px-1 py-2 text-center select-none',
                'transition-colors hover:border-ink',
                'has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-bg',
                'has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60',
                'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink',
              )}
            >
              <input
                type="radio"
                className="sr-only"
                name="unlimited-band"
                value={band}
                checked={checked}
                onChange={() => onChange(band)}
              />
              <span className="text-[16px] leading-tight font-bold">
                <span aria-hidden="true">{checked ? '✓ ' : ''}</span>
                {UNLIMITED.bands[band].label}
              </span>
              <span className="text-[12px] leading-tight opacity-80">{BAND_BLURB[band]}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
