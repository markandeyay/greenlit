import { cx } from '@/components/ui/cx';

export interface ScriptPageProps {
  /** Earned tiers, most vague first. Never contains unearned text. */
  tiers: readonly string[];
  totalTiers: number;
  /** Index of the tier that just arrived (animated, announced). */
  freshIndex?: number | null;
  /** Round over: the last tier is labeled as the full logline. */
  finished?: boolean;
}

/**
 * The logline as a typed script card: the newest draft large and front and center, earlier drafts
 * small underneath, and one progress dot per draft. Locked drafts are only empty dots, so nothing
 * unearned is ever in the DOM.
 */
export function ScriptPage({ tiers, totalTiers, freshIndex = null, finished = false }: ScriptPageProps) {
  const latest = tiers.length - 1;
  const earlier = tiers.slice(0, latest).map((text, i) => ({ text, i })).reverse();
  return (
    <section
      aria-labelledby="logline-page-title"
      className="relative rounded-[var(--radius-lg)] border border-rule bg-surface px-5 pt-4 pb-5 font-mono text-ink shadow-[var(--shadow-md)] sm:px-8 sm:pt-5 sm:pb-7"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="logline-page-title" className="text-[12px] font-bold tracking-[0.16em] text-ink-dim uppercase">
          {finished ? 'The full logline' : 'Logline'}
        </h2>
        <span className="flex items-center gap-2">
          <span className="text-[12px] font-bold text-ink-dim tabular-nums" data-testid="logline-draft">
            Draft {tiers.length} of {totalTiers}
          </span>
          <span aria-hidden="true" className="flex gap-1">
            {Array.from({ length: totalTiers }, (_, i) => (
              <span
                key={i}
                data-locked={i >= tiers.length || undefined}
                className={cx('h-2.5 w-2.5 rounded-full', i < tiers.length ? 'bg-ink' : 'border-[1.5px] border-ink-faint')}
              />
            ))}
          </span>
        </span>
      </div>

      {latest >= 0 ? (
        <p
          key={latest}
          className={cx('mt-4 text-[19px] leading-[1.5] font-bold sm:text-[22px]', freshIndex === latest && 'anim-rise')}
          data-testid="logline-tier"
        >
          {tiers[latest]}
        </p>
      ) : null}

      {earlier.length ? (
        <details className="group mt-5 border-t border-dashed border-rule pt-3" open={finished || undefined}>
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-[12px] font-bold tracking-[0.12em] text-ink-dim uppercase [&::-webkit-details-marker]:hidden">
            <span>Earlier drafts ({earlier.length})</span>
            <span aria-hidden="true" className="transition-transform group-open:rotate-180">
              ▾
            </span>
          </summary>
          <ol className="mt-2 space-y-2">
            {earlier.map(({ text, i }) => (
              <li key={i} className="flex gap-2 text-[14px] leading-snug text-ink-dim">
                <span className="flex-none tabular-nums">{i + 1}.</span>
                <span data-testid="logline-tier">{text}</span>
              </li>
            ))}
          </ol>
        </details>
      ) : !finished && totalTiers > 1 ? (
        <p className="mt-4 text-[13px] text-ink-dim">Each miss unlocks a sharper draft.</p>
      ) : null}
    </section>
  );
}
