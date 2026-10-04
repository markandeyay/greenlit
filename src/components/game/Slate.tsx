import type { ReactNode } from 'react';
import { COPY } from '@/config/brand';
import { RULES } from '@/config/rules';
import { cx } from '@/components/ui/cx';
import { formatSlateDate } from '@/lib/format';

export interface SlateProps {
  /** The page title, rendered as the h1 (e.g. "Reel 004"). */
  title: ReactNode;
  /** Context for screen readers: "Today's reel", "From the Vault", "A pitch". */
  kicker: string;
  take: number;
  maxGuesses?: number;
  /** YYYY-MM-DD, shown under the title. */
  date?: string | null;
  /** Shown under the title when there is no date (e.g. the pitch or a Dailies band). */
  scene?: string | null;
  /** Increment to clap the sticks (a new take landed). 0 never claps. */
  clapKey?: number;
  /** Small controls at the right edge (e.g. the help button). */
  actions?: ReactNode;
  className?: string;
}

/**
 * The clapperboard header (Section 6.4), compact: striped sticks over a single chalk line with the
 * reel title, the date, and TAKE n / 10 with progress dots. The sticks clap each time a take lands
 * (`clapKey` changes), before the row's cells flip. Disabled under reduced motion by the global
 * contract.
 */
export function Slate({
  title,
  kicker,
  take,
  maxGuesses = RULES.maxGuesses,
  date,
  scene,
  clapKey = 0,
  actions,
  className,
}: SlateProps) {
  const shown = Math.min(take, maxGuesses);
  const sub = date ? formatSlateDate(date) : scene || null;
  return (
    <section aria-label="Slate" className={cx('gm-slate', className)}>
      <div key={clapKey} className="gm-slate__stick" data-clap={clapKey > 0 || undefined} aria-hidden="true">
        <span className="gm-slate__hinge" />
      </div>
      <div className="gm-slate__board t-ink">
        <div className="min-w-0 flex-1">
          <p className="sr-only">{kicker}</p>
          <h1 className="gm-chalk truncate text-[clamp(26px,7vw,36px)]">{title}</h1>
          {sub ? <p className="gm-slate__field mt-1 truncate tabular-nums">{sub}</p> : null}
        </div>
        <div className="flex flex-none flex-col items-end gap-1.5">
          <p className="gm-slate__field" aria-hidden="true">
            Take <span className="gm-slate__take tabular-nums">{shown}</span>
            <span className="tabular-nums"> / {maxGuesses}</span>
          </p>
          <p className="sr-only">{COPY.takeLabel(shown, maxGuesses)}</p>
          <span className="gm-pips" aria-hidden="true">
            {Array.from({ length: maxGuesses }, (_, i) => (
              <span key={i} className="gm-pip" data-on={i < shown || undefined} data-now={i === shown - 1 || undefined} />
            ))}
          </span>
        </div>
        {actions ? <div className="-mr-1 flex flex-none items-center">{actions}</div> : null}
      </div>
    </section>
  );
}
