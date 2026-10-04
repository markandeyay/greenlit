'use client';
// Casting Call client island (WS9). Every move goes to the server, which validates it against the
// cast graph and returns the new state. The optimal chain arrives only with a finished state.
// Layout (design brief v2): the chain card on top, then one picker at a time (film, then castmate).
import '@/components/game/game.css';
import { recordLocalPlay } from '@/lib/local-stats';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { COPY } from '@/config/brand';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { Spinner } from '@/components/ui/Spinner';
import { StatusGlyph } from '@/components/ui/StatusGlyph';
import { cx } from '@/components/ui/cx';
import { useToast } from '@/components/ui/Toast';
import { Poster } from '@/components/game/Poster';
import { plural } from '@/lib/format';
import type { ApiError } from '@/lib/types';
import type { CastingCallState, CastingOptionFilm } from '@/server/modes/casting-call/types';
import { CastingBoard } from './CastingBoard';
import { CastingResult } from './CastingResult';
import { Headshot } from './Headshot';
import { OptionPicker, type PickerOption } from './OptionPicker';

const API = '/api/modes/casting-call';

async function request(path: string, body?: unknown): Promise<CastingCallState> {
  const res = await fetch(`${API}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  });
  const data = (await res.json().catch(() => null)) as CastingCallState | ApiError | null;
  if (!res.ok || !data || 'error' in data) {
    throw new Error(data && 'error' in data ? data.error.message : 'Something went wrong. Please try again.');
  }
  return data;
}

/** "Films used 2 / 6" with one pip per allowed film. */
function FilmsMeter({ used, max }: { used: number; max: number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-semibold tabular-nums" data-testid="cc-links">
        Films used {used} / {max}
      </span>
      <span aria-hidden="true" className="flex gap-1">
        {Array.from({ length: max }, (_, i) => (
          <span key={i} className={cx('h-2 w-5 rounded-full', i < used ? 'bg-ink' : 'bg-ink-faint')} />
        ))}
      </span>
    </div>
  );
}

export function CastingCallGame({ initial }: { initial: CastingCallState | null }) {
  const { toast } = useToast();
  const [state, setState] = useState<CastingCallState | null>(initial);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [filmId, setFilmId] = useState<number | null>(null);
  const [confirmGiveUp, setConfirmGiveUp] = useState(false);
  const [announce, setAnnounce] = useState('');
  const filmInput = useRef<HTMLInputElement>(null);
  const actorInput = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLHeadingElement>(null);
  const focusNext = useRef<'film' | 'actor' | 'result' | null>(null);

  useEffect(() => {
    if (initial) return;
    let live = true;
    request('')
      .then((s) => live && setState(s))
      .catch(() => live && setLoadError(true));
    return () => {
      live = false;
    };
  }, [initial]);

  useEffect(() => {
    const target = focusNext.current;
    focusNext.current = null;
    if (target === 'film') filmInput.current?.focus();
    else if (target === 'actor') actorInput.current?.focus();
    else if (target === 'result') resultRef.current?.focus();
  });

  // Record the finished round on this device once (the /modes hub shows "Played today").
  useEffect(() => {
    if (!state || state.status === 'in_progress') return;
    recordLocalPlay({ kind: 'casting_call', ref: state.date, status: state.status, takes: state.chain.length, hintsUsed: 0, finishedAt: new Date().toISOString() });
  }, [state]);

  const current = state ? (state.chain.length ? state.chain[state.chain.length - 1]!.person : state.start) : null;
  const film: CastingOptionFilm | null = useMemo(() => state?.options?.find((f) => f.id === filmId) ?? null, [state, filmId]);
  const finalLink = state ? state.chain.length === state.maxLinks - 1 : false;

  const filmOptions: PickerOption[] = useMemo(
    () =>
      (state?.options ?? []).map((f) => ({
        id: f.id,
        label: f.title,
        keywords: String(f.year),
        thumb: <Poster title={f.title} year={f.year} posterPath={f.posterPath} size="xs" />,
        meta: `${f.year} · ${plural(f.cast.length, 'castmate')}`,
      })),
    [state],
  );

  const actorOptions: PickerOption[] = useMemo(() => {
    if (!film || !state) return [];
    return film.cast.map((p) => {
      const isEnd = p.id === state.end.id;
      const deadEnd = !isEnd && p.onward === 0;
      const note = p.used ? 'already in your chain' : deadEnd ? 'no other films' : undefined;
      return {
        id: p.id,
        label: p.name,
        thumb: <Headshot name={p.name} profilePath={p.profilePath} size="sm" />,
        meta: isEnd ? (
          <span className="inline-flex items-center gap-1 font-semibold text-ink">
            <StatusGlyph verdict="match" /> Your goal
          </span>
        ) : p.used || deadEnd ? (
          p.billing === 'lead' ? 'Lead' : 'Supporting'
        ) : (
          `${p.billing === 'lead' ? 'Lead' : 'Supporting'} · in ${plural(p.onward, 'other film')}`
        ),
        disabled: p.used || deadEnd,
        note,
      };
    });
  }, [film, state]);

  const run = useCallback(
    async (path: string, body: unknown, after: (s: CastingCallState) => void) => {
      setBusy(true);
      try {
        const next = await request(path, body);
        setState(next);
        after(next);
      } catch (e) {
        toast(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
      } finally {
        setBusy(false);
      }
    },
    [toast],
  );

  const chooseFilm = (id: number) => {
    setFilmId(id);
    focusNext.current = 'actor';
  };

  const chooseActor = (personId: number) => {
    if (!state || !film) return;
    const f = film;
    void run('/link', { date: state.date, filmId: f.id, personId }, (s) => {
      setFilmId(null);
      const p = s.chain[s.chain.length - 1]?.person;
      const used = plural(s.chain.length, 'film');
      if (s.status === 'won') setAnnounce(`${p?.name} cast via ${f.title}. Connected in ${used}.`);
      else if (s.status === 'lost') setAnnounce(`${p?.name} cast via ${f.title}. Out of films.`);
      else setAnnounce(`${p?.name} cast via ${f.title}. ${s.chain.length} of ${s.maxLinks} films used.`);
      focusNext.current = s.status === 'in_progress' ? 'film' : 'result';
    });
  };

  const giveUp = () => {
    setConfirmGiveUp(false);
    if (!state) return;
    void run('/giveup', { date: state.date }, () => {
      setFilmId(null);
      setAnnounce('Round ended. The optimal chain is shown.');
      focusNext.current = 'result';
    });
  };

  if (!state) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-rule bg-surface p-5">
        {loadError ? (
          <p className="text-ink-dim">Today&apos;s pair did not load. Reload to try again.</p>
        ) : (
          <p className="flex items-center gap-3 text-ink-dim">
            <Spinner /> Loading today&apos;s pair
          </p>
        )}
      </div>
    );
  }

  const inProgress = state.status === 'in_progress';
  const used = state.chain.length;

  const board = (
    <section aria-label="Your chain" className="rounded-[var(--radius-lg)] border border-rule bg-surface p-3 shadow-[var(--shadow-sm)] sm:p-4">
      <div className="px-2 pb-2">
        <FilmsMeter used={used} max={state.maxLinks} />
      </div>
      <CastingBoard
        label={`Your chain from ${state.start.name} to ${state.end.name}`}
        start={state.start}
        end={state.end}
        chain={state.chain}
        showWanted={inProgress || state.status === 'lost'}
        pending={
          inProgress ? (
            film ? (
              <>
                in <span className="font-semibold text-ink">{film.title}</span>, then who?
              </>
            ) : (
              'pick a film'
            )
          ) : (
            'no connection'
          )
        }
      />
    </section>
  );

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      {!inProgress && state.result ? (
        <CastingResult state={state} headingRef={resultRef}>
          {board}
        </CastingResult>
      ) : (
        board
      )}

      {inProgress && current ? (
        <section aria-labelledby="cc-next" className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 id="cc-next" className="text-xl leading-tight font-bold">
              {film ? (
                <>
                  Pick a castmate from <span className="italic">{film.title}</span>
                </>
              ) : (
                <>Pick a film with {current.name}</>
              )}
            </h2>
            {film ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setFilmId(null);
                  focusNext.current = 'film';
                }}
                disabled={busy}
              >
                Back
              </Button>
            ) : finalLink ? (
              <span className="shrink-0 rounded-full border border-ink px-2.5 py-1 text-xs font-bold">Last film</span>
            ) : null}
          </div>
          {!film ? (
            <OptionPicker
              testId="cc-film-picker"
              label={`Films with ${current.name}`}
              hideLabel
              placeholder={`Search ${plural(filmOptions.length, 'film')}`}
              options={filmOptions}
              onSelect={chooseFilm}
              busy={busy}
              inputRef={filmInput}
              emptyText="No unused films left for this actor. Walk away to see the optimal chain."
            />
          ) : (
            <OptionPicker
              testId="cc-actor-picker"
              label={`Cast of ${film.title}`}
              hideLabel
              placeholder="Search the cast"
              options={actorOptions}
              onSelect={chooseActor}
              busy={busy}
              inputRef={actorInput}
              emptyText="Nobody else is billed in this film."
            />
          )}
          {busy ? (
            <p className="flex items-center gap-2 text-ink-dim">
              <Spinner /> Checking the cast list
            </p>
          ) : null}
          <div className="flex justify-center pt-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirmGiveUp(true)} disabled={busy}>
              {COPY.giveUp}
            </Button>
          </div>
        </section>
      ) : null}

      <p className="sr-only" aria-live="polite" data-testid="cc-announce">
        {announce}
      </p>

      <ConfirmDialog
        open={confirmGiveUp}
        title="Walk away?"
        description="The round ends and the optimal chain is revealed. You cannot come back to today's pair."
        confirmLabel={COPY.giveUp}
        cancelLabel="Keep casting"
        tone="danger"
        onConfirm={giveUp}
        onCancel={() => setConfirmGiveUp(false)}
      />
    </div>
  );
}
