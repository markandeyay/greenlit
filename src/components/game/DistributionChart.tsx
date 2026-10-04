import type { CSSProperties } from 'react';
import { RULES } from '@/config/rules';
import { Tag } from '@/components/ui/Tag';
import { percent } from '@/lib/format';

/**
 * Global take distribution (Section 7.3) as horizontal bars: takes 1 to 10 plus turnaround. The
 * player's bar is solid and tagged YOU (not a status color). Rendered as a list so every bar has
 * a spoken label.
 */
export function DistributionChart({
  distribution,
  plays,
  you,
  animate = false,
}: {
  distribution: number[];
  plays: number;
  /** The player's bucket index. */
  you: number;
  animate?: boolean;
}) {
  const max = Math.max(1, ...distribution);
  return (
    <ol className="grid gap-1" aria-label="How everyone did today">
      {distribution.map((count, i) => {
        const isLoss = i === RULES.maxGuesses;
        const label = isLoss ? 'T' : String(i + 1);
        const pct = percent(count, plays);
        const spoken = `${isLoss ? 'Sent to turnaround' : `Won in ${i + 1} ${i === 0 ? 'take' : 'takes'}`}: ${count} ${count === 1 ? 'player' : 'players'}, ${pct}%${i === you ? ', your result' : ''}.`;
        return (
          <li key={i} className="grid grid-cols-[1.6rem_1fr_auto] items-center gap-2" aria-label={spoken}>
            <span className="text-right font-mono text-[12px] font-bold text-ink-dim tabular-nums" aria-hidden="true">
              {label}
            </span>
            <span className="relative block h-5" aria-hidden="true">
              <span
                className="gm-bar block"
                data-you={i === you || undefined}
                data-animate={animate || undefined}
                style={{ width: `${Math.max(count > 0 ? 3 : 0.5, (count / max) * 100)}%`, '--i': i } as CSSProperties}
              />
            </span>
            <span className="flex min-w-[4.5rem] items-center justify-end gap-1.5 font-mono text-[12px] tabular-nums" aria-hidden="true">
              {i === you ? <Tag tone="solid">You</Tag> : null}
              <span className={i === you ? 'text-ink font-bold' : 'text-ink-dim'}>{pct}%</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
