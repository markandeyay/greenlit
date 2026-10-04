// Take distribution, styled as a call-sheet table: Take 1 to 10 plus Sent to turnaround.
// Bars use ink, never status colors; every row also states its count in text.
import { distributionRows } from './stats-model';

export function Distribution({ distribution, caption }: { distribution: readonly number[]; caption: string }) {
  const rows = distributionRows(distribution);
  return (
    <div className="gl-sheet__scroll" role="region" aria-label={caption} tabIndex={0}>
      <table className="gl-sheet">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col" className="w-[1%]">
              Result
            </th>
            <th scope="col">
              <span className="sr-only">Bar</span>
            </th>
            <th scope="col" className="w-[1%] text-right!">
              Count
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} data-bucket={r.key}>
              <th scope="row" className={r.isTurnaround ? 'whitespace-normal!' : undefined}>
                {r.label}
              </th>
              <td className="align-middle!">
                <span aria-hidden="true" className="block h-3 w-full">
                  <span
                    className={
                      r.isTurnaround
                        ? 'block h-full border border-dashed border-ink bg-[repeating-linear-gradient(135deg,var(--ink-dim)_0_2px,transparent_2px_6px)]'
                        : 'block h-full bg-ink'
                    }
                    style={{ width: r.count ? `max(4px, ${Math.round(r.share * 100)}%)` : '0' }}
                  />
                </span>
              </td>
              <td className="ty-num text-right!">{r.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
