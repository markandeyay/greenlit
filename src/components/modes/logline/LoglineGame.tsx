'use client';

import '@/components/game/game.css';
import { recordLocalPlay } from '@/lib/local-stats';
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { COPY } from '@/config/brand';
import type { ApiError, SearchResult } from '@/lib/types';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { StatusGlyph } from '@/components/ui/StatusGlyph';
import { cx } from '@/components/ui/cx';
import { SearchBox } from '@/components/game/SearchBox';
import { Poster } from '@/components/game/Poster';
import { ShareArtifactPanel } from '@/components/share';
import { ScriptPage } from './ScriptPage';
import { buildLoglineArtifact } from './share';
import type { LoglineStateResponse } from './types';

const API = '/api/modes/logline';

async function request(path: string, init?: RequestInit): Promise<LoglineStateResponse> {
  const res = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  const body = (await res.json().catch(() => null)) as LoglineStateResponse | ApiError | null;
  if (!res.ok || !body || 'error' in body) {
    throw new Error(body && 'error' in body ? body.error.message : 'Something went wrong. Please try again.');
  }
  return body;
}

export interface LoglineGameProps {
  initial: LoglineStateResponse | null;
}

/** Logline mode (Section 5): guess the film from a logline that sharpens with every missed take. */
export function LoglineGame({ initial }: LoglineGameProps) {
  const [state, setState] = useState<LoglineStateResponse | null>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [freshIndex, setFreshIndex] = useState<number | null>(null);
  const [live, setLive] = useState(false);
  const resultRef = useRef<HTMLHeadingElement | null>(null);

  const load = useCallback(() => {
    request(API)
      .then(setState)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load the logline.'));
  }, []);

  useEffect(() => {
    if (!initial) load();
  }, [initial, load]);

  const guessedIds = useMemo(() => new Set(state?.guesses.map((g) => g.filmId) ?? []), [state]);

  const onSelect = async (film: SearchResult) => {
    if (!state || busy) return;
    setBusy(true);
    setError(null);
    try {
      const next = await request(`${API}/guess`, { method: 'POST', body: JSON.stringify({ filmId: film.id }) });
      setFreshIndex(next.status === 'in_progress' && next.tiers.length > state.tiers.length ? next.tiers.length - 1 : null);
      if (next.status !== 'in_progress') setLive(true);
      setState(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That take did not go through.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (live) resultRef.current?.focus();
  }, [live]);

  // Record the finished round on this device once (the /modes hub shows "Played today").
  useEffect(() => {
    if (!state || state.status === 'in_progress') return;
    recordLocalPlay({ kind: 'logline', ref: state.date, status: state.status, takes: state.guesses.length, hintsUsed: 0, finishedAt: new Date().toISOString() });
  }, [state]);

  if (!state) {
    return (
      <div className="flex items-center gap-3 text-ink-dim" role="status">
        {error ? (
          <>
            <span>{error}</span>
            <Button
              size="sm"
              onClick={() => {
                setError(null);
                load();
              }}
            >
              Try again
            </Button>
          </>
        ) : (
          <>
            <Spinner label="Loading" /> Loading today&apos;s logline
          </>
        )}
      </div>
    );
  }

  const finished = state.status !== 'in_progress';
  const tiers = finished && state.reveal ? state.reveal.tiers : state.tiers;
  const take = Math.min(state.take + 1, state.maxTakes);
  const announce = finished
    ? ''
    : state.take === 0
      ? `Draft 1 of ${state.totalTiers}. ${state.tiers[0] ?? ''}`
      : `Missed. Draft ${state.tiers.length} of ${state.totalTiers}: ${state.tiers[state.tiers.length - 1] ?? ''}`;

  return (
    <div className="flex flex-col gap-5">
      {finished ? <Result state={state} live={live} headingRef={resultRef} /> : null}
      <ScriptPage tiers={tiers} totalTiers={state.totalTiers} freshIndex={freshIndex} finished={finished} />
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      {finished ? null : (
        <div className="relative">
          <p className="absolute top-0 right-0 text-sm font-semibold tabular-nums" data-testid="logline-take">
            Take {take} of {state.maxTakes}
          </p>
          <SearchBox label="Name the film" onSelect={onSelect} guessedIds={guessedIds} busy={busy} />
        </div>
      )}
      {error ? (
        <p role="alert" className="text-sm text-ink">
          {error}
        </p>
      ) : null}
      <TakeList state={state} />
    </div>
  );
}

/** The player's takes as compact rows: glyph plus word (never color alone), then the title. */
function TakeList({ state }: { state: LoglineStateResponse }) {
  if (state.guesses.length === 0) return null;
  return (
    <section aria-labelledby="logline-takes-title" data-testid="logline-guesses">
      <h2 id="logline-takes-title" className="text-sm font-semibold">
        Your takes
      </h2>
      <ol className="mt-2 flex flex-col gap-1.5">
        {state.guesses.map((g, i) => (
          <li key={g.filmId} className="flex items-center gap-3 rounded-[var(--radius)] border border-rule bg-surface px-3 py-2 text-[15px]">
            <span
              className="gl-status inline-flex flex-none items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold"
              data-verdict={g.correct ? 'match' : 'miss'}
            >
              {g.correct ? <StatusGlyph verdict="match" /> : <span aria-hidden="true">✕</span>}
              {g.correct ? 'Got it' : 'Miss'}
            </span>
            <span className={cx('min-w-0 flex-1 truncate', !g.correct && 'text-ink-dim')}>
              {g.title} <span className="tabular-nums">({g.year})</span>
            </span>
            <span className="flex-none text-xs text-ink-dim tabular-nums">Take {i + 1}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Result({
  state,
  live,
  headingRef,
}: {
  state: LoglineStateResponse;
  live: boolean;
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  const won = state.status === 'won';
  const stamp = won ? COPY.winStamp : COPY.lossStamp;
  const artifact = useMemo(() => buildLoglineArtifact(state), [state]);
  const reveal = state.reveal;

  return (
    <section aria-labelledby="logline-result-title" className={cx('flex flex-col gap-5', live && 'anim-rise')}>
      <div
        className={cx('rounded-[var(--radius-lg)] border border-rule p-4 sm:p-5', won ? 'gl-status' : 'bg-surface')}
        data-verdict={won ? 'match' : undefined}
      >
        <p aria-hidden="true" className={cx('ty-display inline-block origin-left py-1 text-[clamp(30px,8vw,48px)] leading-none', live && 'anim-stamp')}>
          {won ? (
            <span className="inline-flex items-center gap-3">
              <StatusGlyph verdict="match" /> {stamp}
            </span>
          ) : (
            stamp
          )}
        </p>
        <h2 id="logline-result-title" ref={headingRef} tabIndex={-1} className="mt-3 text-lg leading-snug font-semibold outline-none focus-visible:shadow-none! focus-visible:outline-none!">
          <span className="sr-only">{stamp}. </span>
          {won ? `Sold on take ${state.take}` : 'The script went back to the drawer'}
        </h2>
        {reveal ? (
          <div className="mt-4 flex items-center gap-4">
            <Poster title={reveal.title} year={reveal.year} posterPath={reveal.posterPath} size="sm" />
            <div className="min-w-0">
              <p className="text-xs font-bold tracking-[0.1em] uppercase opacity-75">The film</p>
              <p className="mt-0.5 text-[20px] leading-tight font-bold" data-testid="logline-reveal-title">
                {reveal.title} <span className="text-[15px] font-normal tabular-nums">({reveal.year})</span>
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <div data-testid="logline-share-text" data-share-text={artifact.text} className="max-w-full min-w-0 overflow-x-auto">
        <ShareArtifactPanel artifact={artifact} heading="Share your take" />
      </div>

      <nav aria-label="What next" className="grid grid-cols-2 gap-3">
        <ButtonLink href="/" variant="outline">
          Today&apos;s reel
        </ButtonLink>
        <ButtonLink href="/modes" variant="ghost">
          More modes
        </ButtonLink>
      </nav>
      <p className="text-center text-sm text-ink-dim">A new logline drops at midnight, New York time.</p>
    </section>
  );
}
