'use client';
// Schedule / swap / delete one day, and preview + hand-edit its hint candidates (admin only).
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Hint, SearchResult } from '@/lib/types';
import type { AdminDay, AdminDraftResponse, AdminFilmSummary, AdminPuzzle } from '@/server/admin/types';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import { FilmPicker } from '@/components/pitch/FilmPicker';
import { FilmPoster } from '@/components/pitch/FilmPoster';
import { adminPost, errorMessage, makeAdminSearch } from './admin-api';
import { HintEditor, HintPreview } from './HintEditor';

export interface DayEditorProps {
  day: AdminDay | null;
  hintCount: number;
  cooldownDays: number;
  onClose: () => void;
  onSaved: () => void;
}

function Problems({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <ul className="grid gap-1 border-l-2 border-ink pl-3 text-sm" aria-label="Problems">
      {items.map((p) => (
        <li key={p}>
          <span aria-hidden="true">✕ </span>
          {p}
        </li>
      ))}
    </ul>
  );
}

export function DayEditor({ day, hintCount, cooldownDays, onClose, onSaved }: DayEditorProps) {
  const puzzle: AdminPuzzle | null = day?.puzzle ?? null;
  const [film, setFilm] = useState<SearchResult | null>(null);
  const [summaries, setSummaries] = useState<Map<number, AdminFilmSummary>>(new Map());
  const [hints, setHints] = useState<Hint[]>([]);
  const [hintVersion, setHintVersion] = useState(0);
  const [theme, setTheme] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftProblems, setDraftProblems] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    // Reset the form whenever a different day opens.
    /* eslint-disable react-hooks/set-state-in-effect */
    setFilm(puzzle?.film ? { id: puzzle.film.id, title: puzzle.film.title, year: puzzle.film.year, posterPath: puzzle.film.posterPath } : null);
    setHints(puzzle?.hints ?? []);
    setHintVersion((v) => v + 1);
    setTheme(puzzle?.theme ?? '');
    setError(null);
    setDraftProblems([]);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [day?.date, puzzle]);

  const search = useMemo(
    () => makeAdminSearch(true, (films) => setSummaries((m) => new Map([...m, ...films.map((f) => [f.id, f] as const)]))),
    [],
  );

  const draft = useCallback(async (filmId: number) => {
    setBusy(true);
    setError(null);
    try {
      const res = await adminPost<AdminDraftResponse>('/api/admin/schedule', { action: 'draft', filmId });
      setHints(res.hints);
      setHintVersion((v) => v + 1);
      setDraftProblems(res.problems);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }, []);

  if (!day) return null;
  const editable = day.editable;
  const filmChanged = film !== null && film.id !== puzzle?.filmId;
  const summary = film ? (summaries.get(film.id) ?? (puzzle?.film?.id === film.id ? puzzle.film : null)) : null;
  const otherDates = summary?.scheduled.filter((s) => s.date !== day.date) ?? [];

  const save = async () => {
    if (!film) return;
    setBusy(true);
    setError(null);
    try {
      if (puzzle && !filmChanged && (theme.trim() || null) === (puzzle.theme ?? null)) {
        await adminPost('/api/admin/schedule', { action: 'hints', number: puzzle.number, hints });
      } else {
        await adminPost('/api/admin/schedule', { action: 'schedule', date: day.date, filmId: film.id, theme: theme.trim() || null, hints });
      }
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!puzzle) return;
    setConfirmDelete(false);
    setBusy(true);
    try {
      await adminPost('/api/admin/schedule', { action: 'delete', number: puzzle.number });
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Dialog
        open={!!day && !confirmDelete}
        onClose={onClose}
        wide
        bar={`Reel ${String(day.number).padStart(3, '0')} · ${day.date}`}
        title={editable ? (puzzle ? 'Swap or edit this reel' : 'Schedule this reel') : 'Reel (read only)'}
        description={
          editable
            ? `Answer-eligible films only. A film cannot repeat within ${cooldownDays} days, and every reel needs exactly ${hintCount} hint candidates.`
            : day.isToday
              ? "Today's reel is live and locked."
              : 'Past reels are frozen.'
        }
        actions={
          editable ? (
            <>
              {puzzle ? (
                <Button variant="danger" onClick={() => setConfirmDelete(true)} disabled={busy}>
                  Delete
                </Button>
              ) : null}
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button variant="solid" onClick={save} disabled={busy || !film || hints.length === 0}>
                {busy ? 'Saving' : 'Save reel'}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          )
        }
      >
        <div className="grid gap-5">
          {puzzle?.problems.length ? (
            <div>
              <p className="ty-label mb-1">Stored reel problems</p>
              <Problems items={puzzle.problems} />
            </div>
          ) : null}

          {editable ? (
            <FilmPicker value={film} onChange={(f) => {
              setFilm(f);
              if (f && f.id !== puzzle?.filmId) void draft(f.id);
              if (f && f.id === puzzle?.filmId) {
                setHints(puzzle.hints);
                setHintVersion((v) => v + 1);
              }
            }} label="Answer film" search={search} placeholder="Search answer-eligible films" />
          ) : film ? (
            <div className="flex items-center gap-3">
              <FilmPoster title={film.title} posterPath={film.posterPath} />
              <p className="font-display text-xl font-black uppercase">
                {film.title} <span className="font-mono text-sm font-normal text-ink-dim">{film.year}</span>
              </p>
            </div>
          ) : (
            <p className="text-ink-dim">Nothing scheduled.</p>
          )}

          {summary ? (
            <div className="grid gap-1 font-mono text-xs text-ink-dim">
              {summary.missing.length ? <Problems items={[`Missing required fields: ${summary.missing.join(', ')}.`]} /> : <p>✓ All required fields present.</p>}
              {otherDates.length ? <p>Also scheduled: {otherDates.map((s) => `${s.date} (Reel ${s.number})`).join(', ')}</p> : null}
            </div>
          ) : null}

          {editable ? (
            <label className="block" htmlFor="admin-day-theme">
              <span className="ty-label block text-ink-dim">Theme (optional)</span>
              <input id="admin-day-theme" className="w-full border border-rule bg-bg px-2 py-2 text-ink" value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="e.g. Nolan Week" />
            </label>
          ) : puzzle?.theme ? (
            <p className="text-sm">Theme: {puzzle.theme}</p>
          ) : null}

          {film ? (
            <section aria-label="Hint candidates" className="grid gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="ty-label">Script Notes candidates</p>
                {editable ? (
                  <Button size="sm" variant="ghost" onClick={() => void draft(film.id)} disabled={busy}>
                    Redraft
                  </Button>
                ) : null}
              </div>
              {hints.length ? (
                <div className="grid gap-1 border border-rule p-3">
                  {hints.map((h, i) => (
                    <HintPreview key={i} hint={h} />
                  ))}
                </div>
              ) : null}
              <Problems items={draftProblems} />
              {editable && hints.length ? <HintEditor hints={hints} onChange={setHints} version={hintVersion} /> : null}
            </section>
          ) : null}

          {error ? (
            <p role="alert" className="border-l-2 border-ink pl-3">
              <span aria-hidden="true">✕ </span>
              {error}
            </p>
          ) : null}
        </div>
      </Dialog>
      <ConfirmDialog
        open={confirmDelete}
        title="Delete this reel?"
        description={`Reel ${day.number} on ${day.date} will have no puzzle until you schedule one.`}
        confirmLabel="Delete reel"
        tone="danger"
        onConfirm={() => void remove()}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
