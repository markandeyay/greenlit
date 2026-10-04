'use client';
// Casting Call client island (WS9). Every move goes to the server, which validates it against the
// cast graph and returns the new state. The optimal chain arrives only with a finished state.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { COPY } from '@/config/brand';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { Panel } from '@/components/ui/Panel';
import { Spinner } from '@/components/ui/Spinner';
import { Tag } from '@/components/ui/Tag';
import { useToast } from '@/components/ui/Toast';
import { plural } from '@/lib/format';
import type { ApiError } from '@/lib/types';
import type { CastingCallState, CastingOptionFilm } from '@/server/modes/casting-call/types';
import { CastingBoard } from './CastingBoard';
import { CastingResult } from './CastingResult';
import { Headshot } from './Headshot';
import { OptionPicker, type PickerOption } from './OptionPicker';
import { shortDay } from './shareText';

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

function onwardNote(n: number): string {
  return n === 0 ? 'no other films' : `${plural(n, 'other film')}`;
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

  const current = state ? (state.chain.length ? state.chain[state.chain.length - 1]!.person : state.start) : null;
  const film: CastingOptionFilm | null = useMemo(
    () => state?.options?.find((f) => f.id === filmId) ?? null,
    [state, filmId],
  );
  const finalLink = state ? state.chain.length === state.maxLinks - 1 : false;

  const filmOptions: PickerOption[] = useMemo(
    () =>
      (state?.options ?? []).map((f) => ({
        id: f.id,
        label: f.title,
        keywords: String(f.year),
        meta: `${f.year} · ${plural(f.cast.length, 'castmate')}`,
      })),
    [state],
  );

  const actorOptions: PickerOption[] = useMemo(() => {
    if (!film || !state) return [];
    return film.cast.map((p) => {
      const isEnd = p.id === state.end.id;
      const deadEnd = !isEnd && p.onward === 0;
      const note = p.used ? 'already on the call sheet' : deadEnd ? 'no other films' : undefined;
      return {
        id: p.id,
        label: p.name,
        thumb: <Headshot name={p.name} profilePath={p.profilePath} size="sm" />,
        meta: (
          <>
            {p.billing === 'lead' ? 'Lead' : 'Supporting'}
            {isEnd ? ' · your end actor' : p.used || deadEnd ? '' : ` · ${onwardNote(p.onward)}`}
          </>
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
      if (s.status === 'won') setAnnounce(`${p?.name} cast via ${f.title}. Wrapped in ${used}.`);
      else if (s.status === 'lost') setAnnounce(`${p?.name} cast via ${f.title}. Out of links.`);
      else setAnnounce(`${p?.name} cast via ${f.title}. ${s.chain.length} of ${s.maxLinks} films used.`);
      focusNext.current = s.status === 'in_progress' ? 'film' : 'result';
    });
  };

  const giveUp = () => {
    setConfirmGiveUp(false);
    if (!state) return;
    void run('/giveup', { date: state.date }, () => {
      setFilmId(null);
      setAnnounce('Round ended. The optimal chain is on the call sheet.');
      focusNext.current = 'result';
    });
  };

  if (!state) {
    return (
      <Panel variant="sheet" head={<span>Casting call</span>}>
        {loadError ? (
          <p className="text-ink-dim">The casting office is closed right now. Reload to try again.</p>
        ) : (
          <p className="flex items-center gap-3 text-ink-dim">
            <Spinner /> Pulling the call sheet
          </p>
        )}
      </Panel>
    );
  }

  const inProgress = state.status === 'in_progress';
  const used = state.chain.length;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] lg:items-start">
      <div className="flex min-w-0 flex-col gap-6">
        <Panel
          variant="sheet"
          aria-label="Call sheet"
          head={
            <span className="flex w-full flex-wrap items-center justify-between gap-2">
              <span>Call sheet · {shortDay(state.date)}</span>
              <span className="tabular-nums" data-testid="cc-links">
                Films {used} / {state.maxLinks}
              </span>
            </span>
          }
        >
          <CastingBoard
            label={`Your chain from ${state.start.name} to ${state.end.name}`}
            start={state.start}
            end={state.end}
            chain={state.chain}
            showWanted={inProgress || state.status === 'lost'}
            pending={
              inProgress && film ? (
                <li className="flex items-center gap-3 py-1.5 pr-3 pl-12 sm:pl-14" data-row="pending">
                  <span aria-hidden="true" className="h-6 w-px shrink-0 border-l border-dashed border-rule" />
                  <span className="ty-micro text-ink-dim">Film {used + 1}</span>
                  <span className="min-w-0 truncate font-mono text-sm">
                    via {film.title} ({film.year})
                  </span>
                </li>
              ) : null
            }
          />
        </Panel>

        {inProgress && current ? (
          <section aria-labelledby="cc-next" className="flex flex-col gap-5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 id="cc-next" className="ty-display text-[length:var(--t-d3)]">
                {film ? 'Cast the next actor' : 'Pick a film'}
              </h2>
              {finalLink ? <Tag tone="solid">Final link</Tag> : null}
            </div>
            {!film ? (
              <OptionPicker
                testId="cc-film-picker"
                label={`Films featuring ${current.name}`}
                placeholder="Search their films"
                options={filmOptions}
                onSelect={chooseFilm}
                busy={busy}
                inputRef={filmInput}
                emptyText="No unused films left for this actor. Walk away to see the optimal chain."
              />
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] border border-rule bg-surface px-3 py-2">
                  <span className="min-w-0">
                    <span className="ty-label block">Film {used + 1}</span>
                    <span className="block truncate">
                      {film.title} <span className="text-ink-dim">({film.year})</span>
                    </span>
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setFilmId(null);
                      focusNext.current = 'film';
                    }}
                    disabled={busy}
                  >
                    Change film
                  </Button>
                </div>
                <OptionPicker
                  testId="cc-actor-picker"
                  label={`Cast of ${film.title}`}
                  placeholder="Search the cast"
                  options={actorOptions}
                  onSelect={chooseActor}
                  busy={busy}
                  inputRef={actorInput}
                  emptyText="Nobody else is billed in this film."
                />
              </>
            )}
            {busy ? (
              <p className="flex items-center gap-2 text-ink-dim">
                <Spinner /> Checking the cast list
              </p>
            ) : null}
          </section>
        ) : null}

        {!inProgress && state.result ? <CastingResult state={state} headingRef={resultRef} /> : null}
      </div>

      <aside className="flex flex-col gap-4" aria-label="Casting notes">
        <Panel variant="raised" head={<span>Casting notes</span>}>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="ty-label">Start</dt>
            <dd className="m-0">{state.start.name}</dd>
            <dt className="ty-label">End</dt>
            <dd className="m-0">{state.end.name}</dd>
            <dt className="ty-label">Now</dt>
            <dd className="m-0">{inProgress && current ? current.name : state.status === 'won' ? COPY.winStamp : 'Wrapped'}</dd>
            <dt className="ty-label">Films</dt>
            <dd className="m-0 tabular-nums">
              {used} of {state.maxLinks}
            </dd>
          </dl>
          <p className="mt-4 text-sm text-ink-dim">
            Pick a film the current actor is billed in, then an actor from that film. Reach the end actor in as few
            films as you can. Links are final.
          </p>
        </Panel>
        {inProgress ? (
          <Button variant="ghost" onClick={() => setConfirmGiveUp(true)} disabled={busy}>
            {COPY.giveUp}
          </Button>
        ) : null}
      </aside>

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
