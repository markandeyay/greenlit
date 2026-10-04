'use client';
import './opening-weekend.css';
import '@/components/game/game.css';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { OPENING_WEEKEND } from '@/config/modes';
import { SlateMeta } from '@/components/chrome/SlateMeta';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { Spinner } from '@/components/ui/Spinner';
import { Tag } from '@/components/ui/Tag';
import { useToast } from '@/components/ui/Toast';
import { VisuallyHidden } from '@/components/ui/VisuallyHidden';
import { useIsClient } from '@/components/ui/useIsClient';
import { formatBoxOffice } from '@/lib/format';
import type {
  OwMode,
  OwOutcome,
  OwPairView,
  OwResolved,
  OwSide,
  OwStartResponse,
  OwStatusResponse,
} from '@/server/modes/opening-weekend/types';
import { owApi, OwApiError } from './api';
import { FilmCard, type CardReveal } from './FilmCard';
import { ShareRow } from './ShareRow';

const BEST_KEY = 'gl_ow_best';
const REVEAL_MS = 650;
const EXIT_MS = 170;

function readBest(): number {
  try {
    const v = Number(window.localStorage.getItem(BEST_KEY));
    return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
  } catch {
    return 0;
  }
}
function writeBest(n: number) {
  try {
    window.localStorage.setItem(BEST_KEY, String(n));
  } catch {
    // Private mode: best streak just is not remembered.
  }
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  const forced = document.documentElement.getAttribute('data-reduced-motion');
  if (forced === 'on') return true;
  if (forced === 'off') return false;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

interface Run {
  mode: OwMode;
  date: string | null;
  token: string;
  pair: OwPairView;
  score: number;
  /** Local epoch ms the daily clock ends; null for practice. */
  endsAt: number | null;
  reveal: OwResolved | null;
  leaving: OwSide | null;
  entering: OwSide[];
  busy: boolean;
  over: null | { outcome: OwOutcome };
}

function cardReveal(r: OwResolved | null, side: OwSide): CardReveal | null {
  if (!r) return null;
  const correct = r.picked === r.higher;
  return { gross: r[side].gross, higher: r.higher === side, picked: r.picked === side, correct };
}

function clock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function OpeningWeekend() {
  const { toast } = useToast();
  const [status, setStatus] = useState<OwStatusResponse | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [run, setRun] = useState<Run | null>(null);
  const [starting, setStarting] = useState<OwMode | null>(null);
  const [sessionBest, setSessionBest] = useState(0);
  const isClient = useIsClient();
  const best = isClient ? Math.max(readBest(), sessionBest) : 0;
  const [now, setNow] = useState(() => Date.now());
  const [announce, setAnnounce] = useState('');
  const runRef = useRef<Run | null>(null);
  useLayoutEffect(() => {
    runRef.current = run;
  }, [run]);
  const inflight = useRef(false);
  const finishing = useRef(false);
  const playRef = useRef<HTMLDivElement>(null);

  const refreshStatus = useCallback(async () => {
    try {
      setStatus(await owApi.status());
      setStatusError(false);
    } catch {
      setStatusError(true);
    }
  }, []);

  // The first status call also mints the anon cookie; runs wait for it so the run token and the
  // cookie always name the same player on a first visit.
  const firstLoad = useRef<Promise<unknown> | null>(null);
  useEffect(() => {
    let live = true;
    firstLoad.current = owApi
      .status()
      .then((st) => {
        if (live) setStatus(st);
      })
      .catch(() => {
        if (live) setStatusError(true);
      });
    return () => {
      live = false;
    };
  }, []);

  const recordBest = useCallback((score: number) => {
    if (score > readBest()) writeBest(score);
    setSessionBest((b) => Math.max(b, score));
  }, []);

  const begin = async (mode: OwMode) => {
    if (starting) return;
    setStarting(mode);
    try {
      await firstLoad.current?.catch(() => undefined);
      const res: OwStartResponse = await owApi.start(mode);
      if (res.status === 'done') {
        toast(`Today's run is in the can: ${res.score} in a row.`);
        await refreshStatus();
        return;
      }
      finishing.current = false;
      setRun({
        mode: res.mode,
        date: res.date,
        token: res.token,
        pair: res.pair,
        score: res.pair.step,
        endsAt: res.remainingMs === null ? null : Date.now() + res.remainingMs,
        reveal: null,
        leaving: null,
        entering: [],
        busy: false,
        over: null,
      });
      setAnnounce(
        `${res.status === 'resumed' ? 'Run resumed' : 'Run started'}. ${res.pair.left.title} or ${res.pair.right.title}?`,
      );
      requestAnimationFrame(() => playRef.current?.focus());
    } catch (err) {
      toast(err instanceof OwApiError ? err.message : 'Could not start the run. Please try again.');
    } finally {
      setStarting(null);
    }
  };

  const endRun = useCallback(
    (outcome: OwOutcome, score: number) => {
      setRun((r) => (r ? { ...r, score, busy: false, over: { outcome } } : r));
      const cur = runRef.current;
      if (cur?.mode === 'practice') recordBest(score);
      else void refreshStatus();
    },
    [recordBest, refreshStatus],
  );

  const pick = useCallback(
    async (side: OwSide) => {
      const cur = runRef.current;
      if (!cur || inflight.current || cur.busy || cur.reveal || cur.over) return;
      inflight.current = true;
      setRun({ ...cur, busy: true });
      try {
        const res = await owApi.answer(cur.token, side);
        if (res.result === 'time') {
          setAnnounce(`Time. ${res.score} in a row.`);
          endRun('time', res.score);
          return;
        }
        const r = res.resolved;
        const winner = cur.pair[r.higher];
        const loser = cur.pair[r.higher === 'left' ? 'right' : 'left'];
        const grosses = `${winner.title} ${formatBoxOffice(r[r.higher].gross)}, ${loser.title} ${formatBoxOffice(
          r[r.higher === 'left' ? 'right' : 'left'].gross,
        )}.`;
        if (res.result === 'wrong') {
          setRun((x) => (x ? { ...x, reveal: r } : x));
          setAnnounce(`Wrong. ${grosses} Run over at ${res.score} in a row.`);
          endRun('wrong', res.score);
          return;
        }
        setAnnounce(`Correct. ${grosses} ${res.score} in a row.`);
        const reduced = prefersReducedMotion();
        setRun((x) =>
          x
            ? {
                ...x,
                reveal: r,
                score: res.score,
                endsAt:
                  x.endsAt !== null && res.remainingMs !== null ? Math.min(x.endsAt, Date.now() + res.remainingMs) : x.endsAt,
              }
            : x,
        );
        await wait(reduced ? REVEAL_MS + 150 : REVEAL_MS);
        const losing: OwSide = r.higher === 'left' ? 'right' : 'left';
        if (!reduced) {
          setRun((x) => (x ? { ...x, leaving: losing } : x));
          await wait(EXIT_MS);
        }
        const next = res.next.pair;
        const changed: OwSide[] = (['left', 'right'] as const).filter((s) => next[s].id !== cur.pair[s].id);
        setRun((x) =>
          x && !x.over
            ? { ...x, token: res.next.token, pair: next, reveal: null, leaving: null, entering: changed, busy: false }
            : x,
        );
      } catch (err) {
        if (err instanceof OwApiError && (err.code === 'game_over' || err.code === 'forbidden')) {
          toast(err.message);
          setRun(null);
          void refreshStatus();
          return;
        }
        toast(err instanceof OwApiError ? err.message : 'Connection hiccup. Try that pick again.');
        setRun((x) => (x ? { ...x, busy: false } : x));
      }finally {
        inflight.current = false;
      }
    },
    [endRun, refreshStatus, toast],
  );

  // Daily clock.
  const ticking = Boolean(run && run.endsAt !== null && !run.over);
  useEffect(() => {
    if (!ticking) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [ticking]);

  const msLeft = run?.endsAt != null ? run.endsAt - now : null;
  useEffect(() => {
    const cur = runRef.current;
    if (!cur || cur.over || cur.endsAt === null || msLeft === null || msLeft > 0) return;
    if (cur.busy || cur.reveal || finishing.current) return;
    finishing.current = true;
    owApi
      .finish(cur.token)
      .then((res) => {
        setAnnounce(`Time. ${res.score} in a row.`);
        endRun(res.outcome, res.score);
      })
      .catch(() => endRun('time', cur.score));
  }, [msLeft, endRun]);

  // Keyboard: Left / Right arrows or 1 / 2. One stable listener that reads the latest run and pick
  // through refs, so a key pressed right after a pair appears is never dropped.
  const pickRef = useRef(pick);
  useLayoutEffect(() => {
    pickRef.current = pick;
  }, [pick]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const cur = runRef.current;
      if (!cur || cur.over) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      let side: OwSide | null = null;
      if (e.key === 'ArrowLeft' || e.key === '1') side = 'left';
      if (e.key === 'ArrowRight' || e.key === '2') side = 'right';
      if (!side) return;
      e.preventDefault();
      void pickRef.current(side);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const backToLobby = () => {
    setRun(null);
    void refreshStatus();
  };

  return (
    <div className="mt-10">
      <VisuallyHidden as="div">
        <p aria-live="polite" aria-atomic="true">
          {announce}
        </p>
      </VisuallyHidden>
      {run ? (
        <RunView
          run={run}
          msLeft={msLeft}
          best={best}
          onPick={pick}
          onAgain={() => void begin('practice')}
          onLobby={backToLobby}
          starting={starting}
          playRef={playRef}
        />
      ) : (
        <Lobby status={status} statusError={statusError} best={best} starting={starting} onStart={begin} onRetry={refreshStatus} />
      )}
    </div>
  );
}

function RunView({
  run,
  msLeft,
  best,
  onPick,
  onAgain,
  onLobby,
  starting,
  playRef,
}: {
  run: Run;
  msLeft: number | null;
  best: number;
  onPick: (side: OwSide) => void;
  onAgain: () => void;
  onLobby: () => void;
  starting: OwMode | null;
  playRef: React.RefObject<HTMLDivElement | null>;
}) {
  const daily = run.mode === 'daily';
  const low = msLeft !== null && msLeft <= 10_000;
  return (
    <section aria-label={daily ? 'Daily run' : 'Practice run'} data-testid="ow-run" data-mode={run.mode}>
      <div className="flex flex-wrap items-end justify-between gap-4 border-y border-rule py-3">
        <div>
          <p className="ty-label">{daily ? 'Daily run' : 'Practice'}</p>
          <p className="ty-display text-[length:var(--t-d3)] leading-none" data-testid="ow-score">
            <span className="ty-num">{run.score}</span> in a row
          </p>
        </div>
        {daily ? (
          <div className="text-right">
            <p className="ty-label">Time</p>
            <p
              role="timer"
              aria-label={`${Math.max(0, Math.ceil((msLeft ?? 0) / 1000))} seconds left`}
              className={`ty-num text-[length:var(--t-d3)] leading-none ${low ? 'text-red-rec' : ''}`}
              data-testid="ow-timer"
            >
              {clock(msLeft ?? 0)}
            </p>
          </div>
        ) : (
          <div className="text-right">
            <p className="ty-label">Best</p>
            <p className="ty-num text-[length:var(--t-d3)] leading-none">{best}</p>
          </div>
        )}
      </div>

      <p className="ty-label mt-5 text-center" id="ow-question">
        Which grossed more worldwide?
      </p>
      <div
        ref={playRef}
        tabIndex={-1}
        aria-labelledby="ow-question"
        role="group"
        className="mx-auto mt-3 grid max-w-2xl grid-cols-2 gap-3 outline-none sm:gap-6"
      >
        {(['left', 'right'] as const).map((side) => (
          <FilmCard
            key={`${side}-${run.pair[side].id}`}
            film={run.pair[side]}
            side={side}
            onPick={onPick}
            disabled={run.busy || Boolean(run.reveal) || Boolean(run.over)}
            reveal={cardReveal(run.reveal, side)}
            leaving={run.leaving === side}
            entering={run.entering.includes(side)}
          />
        ))}
      </div>
      <p className="ty-micro mx-auto mt-3 max-w-2xl text-center text-ink-dim">
        Press 1 or Left for the left poster, 2 or Right for the right. Worldwide gross, nominal USD.
      </p>

      {run.over ? (
        <OverPanel
          run={run}
          best={best}
          onAgain={onAgain}
          onLobby={onLobby}
          starting={starting}
        />
      ) : null}
    </section>
  );
}

function OverPanel({
  run,
  best,
  onAgain,
  onLobby,
  starting,
}: {
  run: Run;
  best: number;
  onAgain: () => void;
  onLobby: () => void;
  starting: OwMode | null;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  const wrong = run.over?.outcome === 'wrong';
  return (
    <Panel
      variant="sheet"
      className="mx-auto mt-8 max-w-2xl"
      head={<span>{wrong ? 'Run over' : "That's a wrap"}</span>}
      aria-labelledby="ow-over-title"
    >
      <div data-testid="ow-over" data-outcome={run.over?.outcome}>
        <p className="ty-label">{wrong ? '✗ Wrong pick' : 'Time'}</p>
        <h2 id="ow-over-title" ref={ref} tabIndex={-1} className="ty-display mt-2 text-[length:var(--t-d2)] outline-none">
          <span className="ty-num" data-testid="ow-final-score">
            {run.score}
          </span>{' '}
          in a row
        </h2>
        {run.mode === 'practice' ? <p className="mt-2 text-ink-dim">Best streak: {best}</p> : null}
        {run.mode === 'daily' ? (
          <p className="mt-2 text-ink-dim">One daily run per day. The next pairs drop at midnight New York time.</p>
        ) : null}
        <div className="mt-5">
          <ShareRow score={run.score} mode={run.mode} date={run.date} />
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button variant="slate" onClick={onAgain} disabled={starting !== null}>
            {run.mode === 'practice' ? 'Run it back' : 'Practice run'}
          </Button>
          <Button variant="ghost" onClick={onLobby}>
            Back to the lobby
          </Button>
        </div>
      </div>
    </Panel>
  );
}

function Lobby({
  status,
  statusError,
  best,
  starting,
  onStart,
  onRetry,
}: {
  status: OwStatusResponse | null;
  statusError: boolean;
  best: number;
  starting: OwMode | null;
  onStart: (mode: OwMode) => void;
  onRetry: () => void;
}) {
  const today = status?.today ?? null;
  const seconds = status?.seconds ?? OPENING_WEEKEND.dailyRunSeconds;
  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="grid gap-6">
        <Panel variant="raised" head={<span>The daily run</span>} aria-label="The daily run">
          <SlateMeta roll={status?.date.slice(0, 4)} extra={[`${seconds} sec`, 'Same pairs for everyone']} decorative />
          <p className="mt-3">
            {seconds} seconds on the clock. Pick the poster that grossed more worldwide. The winner stays, a new
            challenger walks in. One wrong pick ends the run. One run per day.
          </p>
          <div className="mt-5" data-testid="ow-daily">
            {!status && !statusError ? (
              <Spinner label="Loading today's run" />
            ) : statusError ? (
              <Button onClick={onRetry}>Try again</Button>
            ) : today?.finished ? (
              <div data-testid="ow-daily-done">
                <p className="ty-display text-[length:var(--t-d3)]">
                  Today: <span className="ty-num">{today.score}</span> in a row
                </p>
                <p className="ty-label mt-1">{today.outcome === 'wrong' ? '✗ Ended on a wrong pick' : 'Ran out the clock'}</p>
                <div className="mt-4">
                  <ShareRow score={today.score} mode="daily" date={status!.date} />
                </div>
              </div>
            ) : (
              <Button variant="slate" size="lg" onClick={() => onStart('daily')} disabled={starting !== null}>
                {starting === 'daily' ? 'Rolling...' : today ? "Resume today's run" : "Start today's run"}
              </Button>
            )}
          </div>
        </Panel>

        <Panel variant="flat" head={<span>Practice</span>} aria-label="Practice">
          <p>Endless pairs, no clock, nothing on the record. Build a streak.</p>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <Button onClick={() => onStart('practice')} disabled={starting !== null}>
              {starting === 'practice' ? 'Rolling...' : 'Start practice'}
            </Button>
            <span className="ty-label" data-testid="ow-best">
              Best streak <b className="ty-num">{best}</b>
            </span>
          </div>
        </Panel>
      </div>

      <Panel variant="sheet" head={<span>Today&apos;s top runs</span>} aria-label="Today's top runs">
        {!status ? (
          <p className="text-ink-dim">{statusError ? 'Board unavailable.' : 'Loading...'}</p>
        ) : (
          <Board status={status} />
        )}
      </Panel>
    </div>
  );
}

function Board({ status }: { status: OwStatusResponse }) {
  const { rows, anonymousCount, totalRuns } = status.board;
  return (
    <div data-testid="ow-board">
      {rows.length ? (
        <ol className="grid gap-1">
          {rows.map((r) => (
            <li key={`${r.rank}-${r.handle}`} className="flex items-baseline justify-between gap-3 border-b border-rule py-1">
              <span className="flex min-w-0 items-baseline gap-3">
                <span className="ty-num w-6 text-ink-dim">{r.rank}</span>
                <span className="truncate">{r.handle}</span>
              </span>
              <span className="ty-num">{r.score}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-ink-dim">No named runs yet today. Sign in and pick a handle to make the board.</p>
      )}
      <p className="ty-label mt-4">
        {totalRuns} {totalRuns === 1 ? 'run' : 'runs'} today
        {anonymousCount > 0 ? ` · ${anonymousCount} anonymous` : ''}
      </p>
      {totalRuns > 0 ? <Tag tone="dim" className="mt-2">Score = correct picks in a row</Tag> : null}
    </div>
  );
}
