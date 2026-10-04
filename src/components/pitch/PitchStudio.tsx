'use client';
// /pitch flow (WS8): pick a film, add an optional note, create, share, then watch results.
import { useEffect, useId, useState, type FormEvent } from 'react';
import { PITCH } from '@/config/game';
import { RULES } from '@/config/rules';
import type { ApiError, PitchResponse, SearchResult } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { cx } from '@/components/ui/cx';
import { FilmPicker } from './FilmPicker';
import { PitchResults } from './PitchResults';
import { ShareLink } from './ShareLink';
import { readRecentPitches, saveRecentPitch, type RecentPitch } from './recent-pitches';

/** Characters as the server counts them (code points). */
export function noteLength(note: string): number {
  return [...note.replace(/\s+/g, ' ').trim()].length;
}

export function PitchStudio() {
  const noteId = useId();
  const countId = useId();
  const [film, setFilm] = useState<SearchResult | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<RecentPitch | null>(null);
  const [recent, setRecent] = useState<RecentPitch[]>([]);
  const [viewing, setViewing] = useState<string | null>(null);

  useEffect(() => {
    // localStorage is only readable after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecent(readRecentPitches());
  }, []);

  const len = noteLength(note);
  const remaining = PITCH.noteMaxLength - len;
  const over = remaining < 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!film || busy || over) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/pitch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ filmId: film.id, note: note.trim() || undefined }),
      });
      const body = (await r.json().catch(() => null)) as PitchResponse | ApiError | null;
      if (!r.ok || !body || 'error' in body) {
        setError(body && 'error' in body ? body.error.message : 'Could not create the challenge. Please try again.');
        return;
      }
      const entry: RecentPitch = { slug: body.slug, url: body.url, film, note: note.trim() || null, createdAt: new Date().toISOString() };
      setRecent(saveRecentPitch(entry));
      setCreated(entry);
      setViewing(null);
    } catch {
      setError('Could not reach the studio. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setCreated(null);
    setFilm(null);
    setNote('');
    setError(null);
  };

  return (
    <div className="grid gap-10">
      {created ? (
        <Panel variant="raised" aria-label="Pitch ready">
          <div className="grid gap-5">
            <p className="gl-h2">
              <span aria-hidden="true">✓ </span>Your pitch is ready
            </p>
            <p className="text-[17px] leading-normal">
              Send the link. Your friend gets {RULES.maxGuesses} takes to guess{' '}
              <strong>{created.film.title}</strong>
              {created.note ? ', and your note unlocks after take ' + PITCH.noteUnlockAfter : ''}.
            </p>
            <ShareLink url={created.url} />
            <div className="flex flex-wrap gap-3">
              <Button variant="slate" onClick={() => setViewing(created.slug)} aria-expanded={viewing === created.slug}>
                See how friends did
              </Button>
              <Button variant="ghost" onClick={reset}>
                Pitch another film
              </Button>
            </div>
          </div>
        </Panel>
      ) : (
        <form onSubmit={submit} className="grid gap-6" aria-describedby={error ? `${noteId}-err` : undefined}>
          <Panel variant="raised" aria-label="New pitch">
            <div className="grid gap-6">
              <FilmPicker value={film} onChange={setFilm} label="01 · The film" placeholder="Search for the film to pitch" />
              <div>
                <label htmlFor={noteId} className="mb-2 block font-semibold">
                  02 · Director&apos;s note (optional)
                </label>
                <textarea
                  id={noteId}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  aria-describedby={countId}
                  aria-invalid={over || undefined}
                  placeholder="A friendly clue"
                  className="w-full resize-y rounded-[var(--radius)] border border-rule bg-bg px-3 py-3 text-base text-ink placeholder:text-ink-dim"
                />
                <div className="mt-1 flex flex-wrap justify-between gap-2 text-sm text-ink-dim">
                  <span>Hidden until take {PITCH.noteUnlockAfter}. Do not name the film.</span>
                  <span id={countId} className={cx('font-mono tabular-nums', over && 'font-bold text-ink underline')}>
                    {len} / {PITCH.noteMaxLength}
                    {over ? ` (${-remaining} over)` : ''}
                  </span>
                </div>
                {remaining <= 20 ? (
                  <p className="sr-only" aria-live="polite">
                    {over ? `${-remaining} characters over the limit` : `${remaining} characters left`}
                  </p>
                ) : null}
              </div>
            </div>
          </Panel>
          {error ? (
            <p id={`${noteId}-err`} role="alert" className="border-l-2 border-ink pl-3">
              <span aria-hidden="true">✕ </span>
              {error}
            </p>
          ) : null}
          <div className="grid justify-items-start gap-2">
            <Button type="submit" variant="slate" size="lg" disabled={!film || busy || over} take={busy ? 'Rolling' : undefined}>
              {busy ? 'Creating' : 'Create challenge'}
            </Button>
            {!film ? <p className="text-sm text-ink-dim">Pick a film to continue.</p> : null}
          </div>
        </form>
      )}

      {viewing ? <PitchResults key={viewing} slug={viewing} /> : null}

      {recent.length > 0 ? (
        <section aria-labelledby={`${noteId}-recent`}>
          <h2 id={`${noteId}-recent`} className="gl-h2 mb-3">
            Your recent pitches
          </h2>
          <ul className="grid gap-2">
            {recent.map((p) => (
              <li key={p.slug} className="flex flex-wrap items-center gap-2 rounded-[var(--radius)] border border-rule bg-surface p-2 pl-3">
                <span className="min-w-0 flex-1 truncate">
                  {p.film.title} <span className="font-mono text-sm text-ink-dim tabular-nums">{p.film.year}</span>
                </span>
                <Button
                  size="sm"
                  variant={viewing === p.slug ? 'solid' : 'outline'}
                  aria-pressed={viewing === p.slug}
                  aria-label={`${viewing === p.slug ? 'Hide results' : 'See how friends did'}: ${p.film.title}`}
                  onClick={() => setViewing(viewing === p.slug ? null : p.slug)}
                >
                  {viewing === p.slug ? 'Hide results' : 'See how friends did'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    void navigator.clipboard?.writeText(p.url).catch(() => undefined);
                  }}
                  aria-label={`Copy link for ${p.film.title}`}
                >
                  Copy link
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
