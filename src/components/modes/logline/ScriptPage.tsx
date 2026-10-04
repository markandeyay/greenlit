import { pad2 } from '@/lib/format';
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
 * The loglines as a typed script page (Courier, scene heading, numbered drafts). Locked drafts
 * render as redaction bars with no text at all, so nothing unearned is ever in the DOM.
 */
export function ScriptPage({ tiers, totalTiers, freshIndex = null, finished = false }: ScriptPageProps) {
  const slots = Array.from({ length: totalTiers }, (_, i) => i);
  return (
    <section aria-labelledby="logline-page-title" className="border-[1.5px] border-ink bg-surface font-mono text-ink">
      <div className="flex items-center justify-between gap-3 border-b border-rule px-4 py-2 text-[11px] font-bold tracking-[0.12em] text-ink-dim uppercase sm:px-6">
        <span className="truncate">INT. THE WRITERS ROOM - NIGHT</span>
        <span className="flex-none tabular-nums">
          Draft {pad2(tiers.length)} / {pad2(totalTiers)}
        </span>
      </div>
      <div className="px-4 py-6 sm:px-10 sm:py-8">
        <h2 id="logline-page-title" className="text-center text-[13px] font-bold tracking-[0.2em] uppercase">
          Logline
        </h2>
        <p className="mt-1 text-center text-[12px] text-ink-dim">(each missed take, a sharper rewrite)</p>
        <ol className="mt-6 space-y-5">
          {slots.map((i) => {
            const text = tiers[i];
            const label = finished && i === totalTiers - 1 ? 'Final draft · the full logline' : `Draft ${pad2(i + 1)}`;
            if (text === undefined) {
              return (
                <li key={i} className="text-ink-dim">
                  <p className="text-[11px] font-bold tracking-[0.12em] uppercase">
                    Draft {pad2(i + 1)} <span className="font-normal normal-case">(locked until a missed take)</span>
                  </p>
                  <div aria-hidden="true" className="mt-2 space-y-1.5">
                    <span className="block h-3 w-[92%] bg-ink-hair" />
                    <span className="block h-3 w-[64%] bg-ink-hair" />
                  </div>
                </li>
              );
            }
            const fresh = freshIndex === i;
            return (
              <li key={i} className={cx(fresh && 'anim-rise')}>
                <p className="text-[11px] font-bold tracking-[0.12em] text-ink-dim uppercase">{label}</p>
                <p
                  className={cx(
                    'mt-1.5 text-[16px] leading-relaxed sm:text-[17px]',
                    i === tiers.length - 1 && !finished ? 'font-bold' : 'text-ink',
                  )}
                  data-testid="logline-tier"
                >
                  {text}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
