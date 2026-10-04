'use client';

import '@/components/game/game.css';
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { COPY, SITE_URL } from '@/config/brand';
import { pad2 } from '@/lib/format';
import type { ApiError, SearchResult } from '@/lib/types';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { cx } from '@/components/ui/cx';
import { useToast } from '@/components/ui/Toast';
import { SearchBox } from '@/components/game/SearchBox';
import { Poster } from '@/components/game/Poster';
import { canUseNativeShare, copyText, nativeShare, xIntentUrl } from '@/components/share/shareActions';
import { ScriptPage } from './ScriptPage';
import { buildLoglineShare, LOGLINE_SHARE_PATH } from './share';
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

  if (!state) {
    return (
      <div className="mt-8 flex items-center gap-3 font-mono text-ink-dim" role="status">
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
            <Spinner label="Loading" /> Threading the script...
          </>
        )}
      </div>
    );
  }

  const finished = state.status !== 'in_progress';
  const tiers = finished && state.reveal ? state.reveal.tiers : state.tiers;
  const announce = finished
    ? ''
    : state.take === 0
      ? `Draft 1 of ${state.totalTiers}. ${state.tiers[0] ?? ''}`
      : `Missed. Draft ${state.tiers.length} of ${state.totalTiers}: ${state.tiers[state.tiers.length - 1] ?? ''}`;

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <div className="min-w-0 space-y-6">
        <TakeStrip state={state} />
        <ScriptPage tiers={tiers} totalTiers={state.totalTiers} freshIndex={freshIndex} finished={finished} />
        <p className="sr-only" aria-live="polite">
          {announce}
        </p>
        {finished ? (
          <Result state={state} live={live} headingRef={resultRef} />
        ) : (
          <SearchBox label="Name the film" onSelect={onSelect} guessedIds={guessedIds} busy={busy} />
        )}
        {error ? (
          <p role="alert" className="font-mono text-[13px] text-ink">
            {error}
          </p>
        ) : null}
      </div>
      <TakeList state={state} />
    </div>
  );
}

/** TAKE n / 6 plus one slot per take. Each used slot carries a glyph and words, not only color. */
function TakeStrip({ state }: { state: LoglineStateResponse }) {
  const finished = state.status !== 'in_progress';
  const current = finished ? state.take : Math.min(state.take + 1, state.maxTakes);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="ty-label text-ink" data-testid="logline-take">
        {COPY.takeLabel(current, state.maxTakes)}
      </p>
      <ol className="flex gap-1.5" aria-label="Takes">
        {Array.from({ length: state.maxTakes }, (_, i) => {
          const g = state.guesses[i];
          const label = g ? `Take ${i + 1}: ${g.correct ? 'correct' : 'miss'}` : `Take ${i + 1}: unused`;
          return (
            <li
              key={i}
              aria-label={label}
              className={cx(
                'grid h-7 w-7 place-items-center font-mono text-[13px] font-bold',
                g ? 'gl-status' : 'border border-dashed border-rule text-ink-dim',
              )}
              data-verdict={g ? (g.correct ? 'match' : 'miss') : undefined}
            >
              <span aria-hidden="true">{g ? (g.correct ? '✓' : '✕') : ''}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function TakeList({ state }: { state: LoglineStateResponse }) {
  return (
    <aside aria-labelledby="logline-takes-title" className="min-w-0 border border-rule bg-surface">
      <h2 id="logline-takes-title" className="border-b border-rule px-4 py-2 font-mono text-[11px] font-bold tracking-[0.12em] text-ink-dim uppercase">
        Takes so far
      </h2>
      {state.guesses.length === 0 ? (
        <p className="px-4 py-4 font-mono text-[13px] text-ink-dim">
          No takes yet. You get {state.maxTakes}. Each miss unlocks a sharper draft.
        </p>
      ) : (
        <ol className="divide-y divide-rule">
          {state.guesses.map((g, i) => (
            <li key={g.filmId} className="flex items-baseline gap-3 px-4 py-2.5 font-mono text-[13px]">
              <span className="flex-none text-ink-dim tabular-nums">Tk {pad2(i + 1)}</span>
              <span className={cx('min-w-0 flex-1 truncate', !g.correct && 'text-ink-dim line-through')}>
                {g.title} <span className="tabular-nums">({g.year})</span>
              </span>
              <span className="flex-none text-[11px] font-bold tracking-[0.1em] uppercase">{g.correct ? '✓ Got it' : 'Miss'}</span>
            </li>
          ))}
        </ol>
      )}
    </aside>
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
  const { toast } = useToast();
  const won = state.status === 'won';
  const stamp = won ? COPY.winStamp : COPY.lossStamp;
  const text = buildLoglineShare(state);
  const reveal = state.reveal;

  const copy = async () => {
    toast((await copyText(text)) ? 'Copied to clipboard' : 'Could not copy. Select the text and copy it by hand.');
  };
  const share = async () => {
    if (!canUseNativeShare()) return copy();
    const r = await nativeShare({ text, url: `${SITE_URL.replace(/\/$/, '')}${LOGLINE_SHARE_PATH}` });
    if (r === 'failed') await copy();
  };

  return (
    <section aria-labelledby="logline-result-title" className={cx('border-[1.5px] border-ink bg-surface', live && 'anim-rise')}>
      <div className="flex items-center justify-between gap-3 border-b border-rule px-4 py-2 font-mono text-[11px] font-bold tracking-[0.12em] text-ink-dim uppercase sm:px-5">
        <span className="truncate">INT. THE SCREENING ROOM - NIGHT</span>
        <span className="flex-none tabular-nums">Tk {pad2(state.take)}</span>
      </div>
      <div className="px-4 pt-4 pb-5 sm:px-6">
        <p
          aria-hidden="true"
          className={cx('gm-stamp my-4 ml-1 text-[clamp(26px,7vw,46px)]', won ? 'gm-stamp--win' : 'gm-stamp--loss', live && 'anim-stamp')}
        >
          {stamp}
        </p>
        <h2 id="logline-result-title" ref={headingRef} tabIndex={-1} className="ty-display text-[clamp(22px,4vw,30px)] leading-none outline-none">
          <span className="sr-only">{stamp}. </span>
          {won ? `Sold on take ${state.take}` : 'The script went back to the drawer'}
        </h2>
        {reveal ? (
          <div className="mt-5 flex items-start gap-4">
            <Poster title={reveal.title} year={reveal.year} posterPath={reveal.posterPath} size="sm" />
            <div className="min-w-0">
              <p className="ty-label text-ink-dim">The film</p>
              <p className="mt-1 text-[20px] font-bold" data-testid="logline-reveal-title">
                {reveal.title} <span className="font-mono text-[15px] font-normal tabular-nums">({reveal.year})</span>
              </p>
              <p className="mt-3 font-mono text-[14px] leading-relaxed text-ink">{reveal.tiers[reveal.tiers.length - 1]}</p>
            </div>
          </div>
        ) : null}

        <div className="mt-6 border-t border-rule pt-5">
          <p className="ty-label mb-3 text-ink">Post your take</p>
          <pre className="overflow-x-auto border border-rule bg-bg px-3 py-2 font-mono text-[13px] whitespace-pre-wrap" data-testid="logline-share-text">
            {text}
          </pre>
          <div className="mt-3 flex flex-wrap gap-3">
            <Button variant="slate" size="sm" onClick={share}>
              Share result
            </Button>
            <Button variant="outline" size="sm" onClick={copy}>
              Copy text
            </Button>
            <a className="gl-btn gl-btn--ghost gl-btn--sm" href={xIntentUrl(text)} target="_blank" rel="noopener noreferrer">
              Post to X
            </a>
          </div>
        </div>
        <nav aria-label="What next" className="mt-5 flex flex-wrap gap-3">
          <ButtonLink href="/" variant="outline" size="sm">
            Today&apos;s reel
          </ButtonLink>
          <ButtonLink href="/modes" variant="ghost" size="sm">
            More modes
          </ButtonLink>
        </nav>
        <p className="mt-4 font-mono text-[12px] text-ink-dim">A new logline drops at midnight, New York time.</p>
      </div>
    </section>
  );
}
