'use client';
import './opening-weekend.css';
import '@/components/game/game.css';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { OPENING_WEEKEND } from '@/config/modes';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { VisuallyHidden } from '@/components/ui/VisuallyHidden';
import { useIsClient } from '@/components/ui/useIsClient';
import { cx } from '@/components/ui/cx';
import { ShareArtifactPanel } from '@/components/share';
import type { ShareArtifact } from '@/components/share/artifact';
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
import { owArtifact } from './share';

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
    <div className="mt-4">
      <VisuallyHidden as="div">
        <p aria-live="polite" aria-atomic="true">
          {announce}
        </p>
      </VisuallyHidden>
      {run ? (
        <RunView
          run={run}
          msLeft={msLeft}
          totalMs={(status?.seconds ?? OPENING_WEEKEND.dailyRunSeconds) * 1000}
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

function TimerBar({ msLeft, totalMs }: { msLeft: number; totalMs: number }) {
  const pct = Math.max(0, Math.min(100, (msLeft / totalMs) * 100));
  const low = msLeft <= 10_000;
  const secs = Math.max(0, Math.ceil(msLeft / 1000));
  return (
    <div className="flex items-center gap-3">
      <div
        className="relative h-3 flex-1 overflow-hidden rounded-full border border-rule bg-surface-2"
        role="progressbar"
        aria-label="Time left"
        aria-valuemin={0}
        aria-valuemax={Math.round(totalMs / 1000)}
        aria-valuenow={secs}
      >
        <div
          className={cx('ow-timer-fill absolute inset-y-0 left-0 rounded-full', low ? 'bg-red-rec' : 'bg-ink')}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p
        role="timer"
        aria-label={`${secs} seconds left`}
        className={cx('ty-num m-0 w-12 text-right font-mono text-[18px] font-bold tabular-nums', low && 'text-red-rec')}
        data-testid="ow-timer"
      >
        {clock(msLeft)}
      </p>
    </div>
  );
}

function RunView({
  run,
  msLeft,
  totalMs,
  best,
  onPick,
  onAgain,
  onLobby,
  starting,
  playRef,
}: {
  run: Run;
  msLeft: number | null;
  totalMs: number;
  best: number;
  onPick: (side: OwSide) => void;
  onAgain: () => void;
  onLobby: () => void;
  starting: OwMode | null;
  playRef: React.RefObject<HTMLDivElement | null>;
}) {
  const daily = run.mode === 'daily';
  const verdict = run.reveal ? (run.reveal.picked === run.reveal.higher ? 'correct' : 'wrong') : null;
  return (
    <section aria-label={daily ? "Today's run" : 'Practice run'} className="mx-auto max-w-xl" data-testid="ow-run" data-mode={run.mode}>
      <div className="flex items-center justify-between gap-3">
        <p className="m-0 flex items-baseline gap-2" data-testid="ow-score">
          <span className="ty-display text-[40px] leading-none tabular-nums">{run.score}</span>{' '}
          <span className="text-[15px] font-semibold">in a row</span>
        </p>
        <p className="m-0 font-mono text-[12px] tracking-[0.1em] text-ink-dim uppercase">
          {daily ? "Today's run" : `Practice · Best ${best}`}
        </p>
      </div>
      {daily ? (
        <div className="mt-2">
          <TimerBar msLeft={msLeft ?? 0} totalMs={totalMs} />
        </div>
      ) : null}

      <div className="mt-3 flex min-h-9 items-center justify-center">
        {verdict ? (
          <p
            key={`${run.pair.left.id}-${run.pair.right.id}`}
            className={cx(
              'ow-flash m-0 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[16px] font-bold',
              verdict === 'correct' ? 'bg-green text-green-ink' : 'bg-red-rec text-white',
            )}
            data-testid="ow-verdict"
            aria-hidden="true"
          >
            {verdict === 'correct' ? '✓ Correct' : '✗ Wrong'}
          </p>
        ) : (
          <h2 className="m-0 text-center text-[18px] font-semibold" id="ow-question">
            Which made more?
          </h2>
        )}
      </div>
      <div
        ref={playRef}
        tabIndex={-1}
        aria-label="Which grossed more worldwide?"
        role="group"
        className="mx-auto mt-2 grid max-w-xl grid-cols-2 gap-3 outline-none sm:gap-5"
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

      {run.over ? <OverPanel run={run} best={best} onAgain={onAgain} onLobby={onLobby} starting={starting} /> : null}
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
  const outcome = run.over?.outcome ?? 'wrong';
  const wrong = outcome === 'wrong';
  const artifact = owArtifact(run.score, run.mode, run.date, outcome);
  return (
    <section
      className="mx-auto mt-6 max-w-xl border-t-2 border-ink pt-4"
      data-testid="ow-over"
      data-outcome={outcome}
      aria-labelledby="ow-over-title"
    >
      <p className="m-0 font-mono text-[12px] font-bold tracking-[0.12em] uppercase">
        {wrong ? '✗ Run over' : "⏱ Time's up"}
      </p>
      <h2 id="ow-over-title" ref={ref} tabIndex={-1} className="ty-display m-0 mt-1 text-[44px] leading-none outline-none">
        <span data-testid="ow-final-score">
          {run.score}
        </span>{' '}
        in a row
      </h2>
      <p className="m-0 mt-2 text-ink-dim">
        {run.mode === 'practice' ? `Best streak: ${best}` : 'One run a day. New pairs at midnight New York time.'}
      </p>
      <OwShare artifact={artifact} className="mt-4" />
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Button variant="outline" block onClick={onAgain} disabled={starting !== null}>
          {run.mode === 'practice' ? 'Play again' : 'Practice'}
        </Button>
        <Button variant="ghost" block onClick={onLobby}>
          Back
        </Button>
      </div>
    </section>
  );
}

/** The share card for a run. The wrapper carries the text so tests can check it whatever the panel renders. */
function OwShare({ artifact, className }: { artifact: ShareArtifact; className?: string }) {
  return (
    <div className={cx("min-w-0 [&_pre]:break-words [&_pre]:whitespace-pre-wrap", className)} data-testid="ow-share" data-share-text={artifact.text}>
      <ShareArtifactPanel artifact={artifact} />
    </div>
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
    <div className="mx-auto grid max-w-xl gap-6 pt-6">
      <div className="grid gap-3">
        <div data-testid="ow-daily">
          {!status && !statusError ? (
            <div className="flex min-h-16 items-center justify-center">
              <Spinner label="Loading today's run" />
            </div>
          ) : statusError ? (
            <Button block size="lg" onClick={onRetry}>
              Try again
            </Button>
          ) : today?.finished ? (
            <div data-testid="ow-daily-done">
              <p className="m-0 font-mono text-[12px] font-bold tracking-[0.12em] uppercase">Today&apos;s run</p>
              <p className="ty-display m-0 mt-1 text-[40px] leading-none">
                <span>{today.score}</span> in a row
              </p>
              <p className="m-0 mt-1 text-ink-dim">
                {today.outcome === 'wrong' ? '✗ Ended on a wrong pick.' : '⏱ Ran out the clock.'} Back tomorrow.
              </p>
              <OwShare artifact={owArtifact(today.score, 'daily', status!.date, today.outcome)} className="mt-4" />
            </div>
          ) : (
            <Button variant="slate" size="lg" block onClick={() => onStart('daily')} disabled={starting !== null}>
              {starting === 'daily' ? 'Starting...' : today ? "Resume today's run" : `Today's run (${seconds}s)`}
            </Button>
          )}
        </div>
        <Button size="lg" block onClick={() => onStart('practice')} disabled={starting !== null}>
          {starting === 'practice' ? 'Starting...' : 'Practice'}
        </Button>
        <p className="m-0 text-center font-mono text-[12px] text-ink-dim" data-testid="ow-best">
          Best practice streak <b className="ty-num text-ink">{best}</b>
        </p>
      </div>

      <section aria-labelledby="ow-board-title" className="border-t border-rule pt-4">
        <h2 id="ow-board-title" className="m-0 font-mono text-[12px] font-bold tracking-[0.12em] uppercase">
          Today&apos;s top runs
        </h2>
        {!status ? (
          <p className="m-0 mt-2 text-ink-dim">{statusError ? 'Board unavailable.' : 'Loading...'}</p>
        ) : (
          <Board status={status} />
        )}
      </section>
    </div>
  );
}

function Board({ status }: { status: OwStatusResponse }) {
  const { rows, anonymousCount, totalRuns } = status.board;
  return (
    <div data-testid="ow-board" className="mt-2">
      {rows.length ? (
        <ol className="m-0 grid list-none gap-1 p-0">
          {rows.slice(0, 5).map((r) => (
            <li key={`${r.rank}-${r.handle}`} className="flex items-baseline justify-between gap-3 border-b border-rule py-1">
              <span className="flex min-w-0 items-baseline gap-3">
                <span className="ty-num w-6 text-ink-dim">{r.rank}</span>
                <span className="truncate">{r.handle}</span>
              </span>
              <span className="ty-num font-bold">{r.score}</span>
            </li>
          ))}
        </ol>
      ) : null}
      <p className="m-0 mt-2 text-[14px] text-ink-dim">
        {totalRuns} {totalRuns === 1 ? 'run' : 'runs'} today
        {anonymousCount > 0 ? ` · ${anonymousCount} anonymous` : ''}
        {rows.length ? '' : '. Sign in and pick a handle to make the board.'}
      </p>
    </div>
  );
}
