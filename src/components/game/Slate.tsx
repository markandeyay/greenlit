import type { ReactNode } from 'react';
import { APP_NAME, COPY } from '@/config/brand';
import { RULES } from '@/config/rules';
import { cx } from '@/components/ui/cx';
import { formatSlateDate, pad2 } from '@/lib/format';

export interface SlateProps {
  /** The page title, rendered as the h1 (e.g. "Reel No. 004"). */
  title: ReactNode;
  /** Small line above the title: "Today's reel", "From the Vault", "A pitch". */
  kicker: string;
  take: number;
  maxGuesses?: number;
  /** YYYY-MM-DD, shown in the DATE field. */
  date?: string | null;
  /** Scene field: the theme or a stand-in. */
  scene?: string | null;
  /** Production field. */
  production?: string;
  /** Increment to clap the sticks (a new take landed). 0 never claps. */
  clapKey?: number;
  className?: string;
}

/**
 * The clapperboard header (Section 6.4): striped sticks on a chalk board with PROD, REEL, SCENE,
 * DATE and TAKE n / 10. The sticks clap each time a take lands (`clapKey` changes), before the
 * row's cells flip. Disabled under reduced motion by the global contract.
 */
export function Slate({
  title,
  kicker,
  take,
  maxGuesses = RULES.maxGuesses,
  date,
  scene,
  production = APP_NAME,
  clapKey = 0,
  className,
}: SlateProps) {
  const shown = Math.min(take, maxGuesses);
  return (
    <section aria-label="Slate" className={cx('gm-slate', className)}>
      <div
        key={clapKey}
        className="gm-slate__stick"
        data-clap={clapKey > 0 || undefined}
        aria-hidden="true"
      >
        <span className="gm-slate__hinge" />
      </div>
      <div className="gm-slate__board t-ink">
        <div className="grid grid-cols-[1fr_auto] gap-4 px-4 pt-4 pb-3 sm:px-5">
          <div className="min-w-0">
            <p className="gm-slate__field">{kicker}</p>
            <h1 className="gm-chalk mt-2 text-[clamp(40px,10vw,76px)]">{title}</h1>
          </div>
          <div className="flex flex-col items-end text-right">
            <p className="gm-slate__field">Take</p>
            <p className="gm-chalk mt-2 text-[clamp(40px,10vw,76px)] tabular-nums" aria-hidden="true">
              {pad2(shown)}
              <span className="text-ink-dim text-[0.42em]"> / {pad2(maxGuesses)}</span>
            </p>
            <p className="sr-only" aria-live="off">
              {COPY.takeLabel(shown, maxGuesses)}
            </p>
          </div>
        </div>
        <div className="gm-slate__grid border-t border-ink-faint">
          <dl className="grid grid-cols-2 sm:grid-cols-[1.4fr_1fr_1fr]">
            <div className="min-w-0 border-r border-ink-faint px-4 py-2 sm:px-5">
              <dt className="gm-slate__field">Scene</dt>
              <dd className="truncate font-mono text-[13px] font-bold">{scene || 'The mystery film'}</dd>
            </div>
            <div className="min-w-0 px-4 py-2 sm:border-r sm:border-ink-faint">
              <dt className="gm-slate__field">Date</dt>
              <dd className="font-mono text-[13px] font-bold tabular-nums">{date ? formatSlateDate(date) : 'Any day'}</dd>
            </div>
            <div className="col-span-2 min-w-0 border-t border-ink-faint px-4 py-2 sm:col-span-1 sm:border-t-0 sm:px-5">
              <dt className="gm-slate__field">Prod.</dt>
              <dd className="flex items-center justify-between gap-3">
                <span className="truncate font-mono text-[13px] font-bold">{production}</span>
                <span className="gm-pips" aria-hidden="true">
                {Array.from({ length: maxGuesses }, (_, i) => (
                  <span key={i} className="gm-pip" data-on={i < shown || undefined} data-now={i === shown - 1 || undefined} />
                ))}
                </span>
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
