// Take distribution as Wordle-style bars: takes 1 to 10 plus sent to turnaround. Bars use ink,
// never status colors; every row also states its count in text.
import { distributionRows } from './stats-model';

export function Distribution({ distribution, caption }: { distribution: readonly number[]; caption: string }) {
  const rows = distributionRows(distribution);
  return (
    <table className="gl-dist">
      <caption>
        <span className="gl-h2 block">Distribution</span>
        <span className="sr-only">{caption}</span>
      </caption>
      <thead className="sr-only">
        <tr>
          <th scope="col">Result</th>
          <th scope="col">Count</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key} data-bucket={r.key}>
            <th scope="row">
              {r.isTurnaround ? (
                <>
                  <span aria-hidden="true">✕</span>
                  <span className="sr-only">{r.label}</span>
                </>
              ) : (
                <>
                  <span className="sr-only">Take </span>
                  {r.label.replace(/^\D+/, '')}
                </>
              )}
            </th>
            <td>
              <span
                className="gl-dist__bar"
                data-zero={r.count === 0 || undefined}
                data-loss={(r.isTurnaround && r.count > 0) || undefined}
                style={{ width: r.count ? `max(28px, ${Math.round(r.share * 100)}%)` : undefined }}
              >
                {r.count}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
