'use client';
// "See how friends did": the creator-only results view for one pitch. Polls
// GET /api/pitch/[slug]/results while the tab is visible. The creator chose the film, so the
// reveal card is shown here; nobody else can load this data (server checks creator proof).
import { useCallback, useEffect, useState } from 'react';
import { COPY } from '@/config/brand';
import { RULES } from '@/config/rules';
import { HINT_TYPE_LABELS } from '@/config/hints';
import type { ApiError, PitchResultRow, PitchResultsResponse } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { Spinner } from '@/components/ui/Spinner';
import { FilmPoster } from './FilmPoster';

export const RESULTS_POLL_MS = 15_000;

export function resultLabel(row: PitchResultRow): { glyph: string; text: string } {
  if (row.status === 'won') return { glyph: '✓', text: COPY.winStamp };
  if (row.status === 'lost') return { glyph: '✕', text: COPY.lossStamp };
  return { glyph: '…', text: 'Still shooting' };
}

function when(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function PitchResults({ slug }: { slug: string }) {
  const [data, setData] = useState<PitchResultsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/pitch/${encodeURIComponent(slug)}/results`, { cache: 'no-store' });
      if (!r.ok) {
        const body = (await r.json().catch(() => null)) as ApiError | null;
        setError(
          r.status === 403
            ? 'Results are only visible on the device (or account) that made this pitch.'
            : (body?.error.message ?? 'Could not load results.'),
        );
      } else {
        setData((await r.json()) as PitchResultsResponse);
        setError(null);
      }
    } catch {
      setError('Could not load results. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (!timer) timer = setInterval(() => void load(), RESULTS_POLL_MS);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        void load();
        start();
      } else stop();
    };
    // Initial fetch: state is set only after the network round trip, never synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    start();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [load]);

  const finished = data?.results.filter((r) => r.status !== 'in_progress') ?? [];
  const wins = finished.filter((r) => r.status === 'won');

  return (
    <Panel
      variant="sheet"
      head={
        <>
          <span>How friends did</span>
          <span className="tabular-nums">{data ? `${data.results.length} on set` : ''}</span>
        </>
      }
    >
      {loading && !data ? <Spinner label="Loading results" showLabel /> : null}
      {error ? (
        <p role="alert" className="text-ink-dim">
          {error}
        </p>
      ) : null}
      {data ? (
        <div className="grid gap-5">
          <div className="flex items-center gap-4">
            <FilmPoster title={data.film.title} posterPath={data.film.posterPath} size="md" />
            <div className="min-w-0">
              <p className="ty-label text-ink-dim">You pitched</p>
              <p className="font-display text-2xl font-black uppercase leading-tight">{data.film.title}</p>
              <p className="font-mono text-sm text-ink-dim">
                <span className="tabular-nums">{data.film.year}</span> · {data.film.director}
              </p>
            </div>
          </div>

          {data.results.length === 0 ? (
            <p className="text-ink-dim">No takes yet. Send the link and check back here.</p>
          ) : (
            <>
              <p className="font-mono text-sm">
                <span className="tabular-nums">{wins.length}</span> greenlit ·{' '}
                <span className="tabular-nums">{finished.length - wins.length}</span> sent to turnaround ·{' '}
                <span className="tabular-nums">{data.results.length - finished.length}</span> still shooting
              </p>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <caption className="sr-only">Results for this pitch</caption>
                  <thead>
                    <tr className="border-b border-rule font-mono text-xs uppercase tracking-widest text-ink-dim">
                      <th scope="col" className="py-2 pr-3 font-bold">Player</th>
                      <th scope="col" className="py-2 pr-3 font-bold">Result</th>
                      <th scope="col" className="py-2 pr-3 font-bold">Takes</th>
                      <th scope="col" className="py-2 pr-3 font-bold" title={HINT_TYPE_LABELS.creator_note}>Notes</th>
                      <th scope="col" className="hidden py-2 font-bold sm:table-cell">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.results.map((row, i) => {
                      const label = resultLabel(row);
                      return (
                        <tr key={i} className="border-b border-rule last:border-b-0">
                          <td className="py-2 pr-3">{row.handle ?? 'Anonymous player'}</td>
                          <td className="py-2 pr-3 font-mono text-xs font-bold uppercase">
                            <span aria-hidden="true">{label.glyph} </span>
                            {label.text}
                          </td>
                          <td className="py-2 pr-3 font-mono tabular-nums">
                            {row.takes ?? 0} / {RULES.maxGuesses}
                          </td>
                          <td className="py-2 pr-3 font-mono tabular-nums">{row.hintsUsed}</td>
                          <td className="hidden py-2 font-mono text-xs text-ink-dim sm:table-cell">{when(row.finishedAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <div>
            <Button variant="ghost" size="sm" onClick={() => void load()}>
              Refresh
            </Button>
          </div>
        </div>
      ) : null}
    </Panel>
  );
}
