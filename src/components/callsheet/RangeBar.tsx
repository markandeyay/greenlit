import { scalePosition } from '@/lib/callsheet/domain';

export interface RangeBarTick {
  value: number;
  /** The most recent guess is drawn taller and solid. */
  emphasized?: boolean;
}

export interface RangeBarProps {
  /** Accessible text alternative, e.g. "Year between 2007 and 2011". Required. */
  label: string;
  domain: [number, number];
  /** Known range. A null side is unbounded and runs to the domain edge. */
  lo: number | null;
  hi: number | null;
  ticks?: RangeBarTick[];
  scale?: 'linear' | 'log';
  /** Optional formatter for the domain end labels. Omit to hide end labels. */
  formatEdge?: (value: number) => string;
  className?: string;
}

/**
 * Horizontal bar: the known range highlighted inside a domain, with a tick per guess value.
 * Purely visual (role="img" with a text alternative); fluid width, fine at 375px.
 */
export function RangeBar({ label, domain, lo, hi, ticks = [], scale = 'linear', formatEdge, className }: RangeBarProps) {
  const start = lo === null ? 0 : scalePosition(lo, domain, scale);
  const end = hi === null ? 1 : scalePosition(hi, domain, scale);
  const left = Math.min(start, end);
  const width = Math.max(Math.abs(end - start), 0.012);
  const pct = (t: number) => `${(t * 100).toFixed(3)}%`;

  return (
    <div className={['w-full min-w-0', className].filter(Boolean).join(' ')}>
      <div role="img" aria-label={label} className="relative h-5 w-full" data-scale={scale}>
        {/* track */}
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full border border-rule bg-surface-2" />
        {/* known range */}
        <div
          data-testid="rangebar-range"
          className={[
            'absolute top-1/2 h-2.5 -translate-y-1/2 border-y border-ink/70 bg-ink/25',
            lo === null ? 'rounded-l-none border-l-0' : 'rounded-l-sm border-l-2 border-l-ink',
            hi === null ? 'rounded-r-none border-r-0' : 'rounded-r-sm border-r-2 border-r-ink',
          ].join(' ')}
          style={{ left: pct(left), width: pct(Math.min(width, 1 - left)) }}
        />
        {/* guess ticks */}
        {ticks.map((t, i) => {
          const x = scalePosition(t.value, domain, scale);
          return (
            <span
              key={`${t.value}-${i}`}
              data-testid={t.emphasized ? 'rangebar-tick-last' : 'rangebar-tick'}
              className={[
                'absolute top-1/2 -translate-x-1/2 -translate-y-1/2',
                t.emphasized ? 'h-5 w-[3px] bg-ink' : 'h-3 w-px bg-ink-dim',
              ].join(' ')}
              style={{ left: pct(x) }}
            />
          );
        })}
      </div>
      {formatEdge ? (
        <div aria-hidden="true" className="mt-0.5 flex justify-between font-mono text-[10px] tabular-nums text-ink-dim">
          <span>{formatEdge(domain[0])}</span>
          <span>{scale === 'log' ? 'log scale' : ''}</span>
          <span>{formatEdge(domain[1])}</span>
        </div>
      ) : null}
    </div>
  );
}
