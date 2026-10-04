'use client';
// Admin calendar: recent past (read only), today (locked once live), and the scheduling window.
import { useCallback, useEffect, useState } from 'react';
import type { AdminDay, AdminScheduleResponse } from '@/server/admin/types';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Tag } from '@/components/ui/Tag';
import { cx } from '@/components/ui/cx';
import { FilmPoster } from '@/components/pitch/FilmPoster';
import { adminGet, errorMessage } from './admin-api';
import { DayEditor } from './DayEditor';

export function useSchedule() {
  const [data, setData] = useState<AdminScheduleResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    try {
      setData(await adminGet<AdminScheduleResponse>('/api/admin/schedule'));
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);
  return { data, error, reload };
}

function dayStatus(day: AdminDay): string {
  if (day.isToday) return 'LIVE';
  if (day.isPast) return 'WRAPPED';
  return day.puzzle ? 'SCHEDULED' : 'OPEN';
}

export function CalendarView({ schedule }: { schedule: ReturnType<typeof useSchedule> }) {
  const { data, error, reload } = schedule;
  const [open, setOpen] = useState<AdminDay | null>(null);
  const [showPast, setShowPast] = useState(false);

  if (error) return <p role="alert">✕ {error}</p>;
  if (!data) return <Spinner label="Loading schedule" showLabel />;

  const days = data.days.filter((d) => showPast || !d.isPast);
  const future = data.days.filter((d) => !d.isPast);
  const empty = future.filter((d) => !d.puzzle).length;
  const problems = future.filter((d) => d.puzzle?.problems.length).length;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-sm">
          Today <b>{data.today}</b> · window {data.aheadDays} days · <span className="tabular-nums">{empty}</span> open ·{' '}
          <span className="tabular-nums">{problems}</span> with problems
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" aria-pressed={showPast} onClick={() => setShowPast((v) => !v)}>
            {showPast ? 'Hide recent past' : 'Show recent past'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => void reload()}>
            Refresh
          </Button>
        </div>
      </div>
      <ol className="grid gap-2" aria-label="Schedule by day">
        {days.map((d) => {
          const p = d.puzzle;
          return (
            <li key={d.date}>
              <button
                type="button"
                onClick={() => setOpen(d)}
                className={cx(
                  'flex w-full items-center gap-3 border p-2 text-left',
                  d.isToday ? 'border-ink' : 'border-rule',
                  !p && !d.isPast && 'border-dashed',
                )}
                aria-label={`${d.date}, Reel ${d.number}, ${dayStatus(d)}${p?.film ? `, ${p.film.title}` : ''}${p?.problems.length ? `, ${p.problems.length} problems` : ''}`}
              >
                <span className="w-24 shrink-0 font-mono text-xs tabular-nums">
                  <span className="block font-bold">{d.date.slice(5)}</span>
                  <span className="text-ink-dim">Reel {String(d.number).padStart(3, '0')}</span>
                </span>
                {p?.film ? <FilmPoster title={p.film.title} posterPath={p.film.posterPath} /> : null}
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{p?.film ? `${p.film.title} (${p.film.year})` : p ? `Film #${p.filmId}` : 'Open date'}</span>
                  <span className="flex flex-wrap gap-1">
                    <Tag tone={d.isToday ? 'solid' : 'line'}>{dayStatus(d)}</Tag>
                    {p?.theme ? <Tag tone="dim">{p.theme}</Tag> : null}
                    {p?.problems.length ? <Tag>✕ {p.problems.length} problem{p.problems.length > 1 ? 's' : ''}</Tag> : null}
                  </span>
                </span>
                <span aria-hidden="true" className="font-mono text-xs text-ink-dim">
                  {d.editable ? 'EDIT' : 'VIEW'}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <DayEditor
        day={open}
        hintCount={data.hintCount}
        cooldownDays={data.cooldownDays}
        onClose={() => setOpen(null)}
        onSaved={() => {
          setOpen(null);
          void reload();
        }}
      />
    </div>
  );
}
