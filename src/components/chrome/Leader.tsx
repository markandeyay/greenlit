'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { APP_NAME } from '@/config/brand';
import { LAUNCH_DATE, STORAGE_KEYS } from '@/config/game';
import { dateInResetZone } from '@/lib/dates';
import { prefersReducedMotionNow } from '@/lib/settings';

// The countdown leader (Sections 6.1, 6.6): an Academy leader, 8 down to 2, then a flash frame
// and the field lifts. About 1.2s. First visit of the day only (STORAGE_KEYS.leaderSeen holds
// the New York date it last played). Skippable by click, any key, or the Skip button. Purely
// decorative: aria-hidden, nothing focusable, no live region, never blocks the keyboard, and
// never runs under reduced motion. Client-only overlay with fixed positioning: no layout shift.

export const LEADER_FROM = 8;
export const LEADER_TO = 2;
export const LEADER_STEP_MS = 130; // 7 numbers x 130ms = 910ms
export const LEADER_FLASH_MS = 80;
export const LEADER_LIFT_MS = 220;
export const LEADER_REPLAY_EVENT = 'gl:leader-replay';

type Phase = 'idle' | 'count' | 'flash' | 'out';

// Decided once per page load (survives Strict Mode effect replays and client navigation).
let decided: boolean | null = null;
let started = false;

function readSeen(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEYS.leaderSeen);
  } catch {
    return null;
  }
}

function writeSeen(date: string) {
  try {
    window.localStorage.setItem(STORAGE_KEYS.leaderSeen, date);
  } catch {
    // Storage blocked: the module-level decision still stops repeats within this page view.
  }
}

/** Should the leader play right now? Pure apart from its inputs. */
export function shouldPlayLeader(opts: { seen: string | null; today: string; reducedMotion: boolean }): boolean {
  if (opts.reducedMotion) return false;
  return opts.seen !== opts.today;
}

/** Replay the leader (kitchen sink, settings preview). Still respects reduced motion. */
export function replayLeader() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(LEADER_REPLAY_EVENT));
}

/** Test helper. */
export function __resetLeaderForTests() {
  decided = null;
  started = false;
}

export function Leader() {
  const [phase, setPhase] = useState<Phase>('idle');
  const numRef = useRef<HTMLSpanElement>(null);
  const sweepRef = useRef<HTMLSpanElement>(null);
  const tcRef = useRef<HTMLSpanElement>(null);

  const skip = useCallback(() => setPhase('idle'), []);

  // Decide on mount; listen for replays.
  useEffect(() => {
    let raf = 0;
    const start = () => {
      raf = requestAnimationFrame(() => {
        started = true;
        setPhase('count');
      });
    };
    if (decided === null) {
      const today = dateInResetZone();
      decided = shouldPlayLeader({ seen: readSeen(), today, reducedMotion: prefersReducedMotionNow() });
      if (decided) writeSeen(today);
    }
    if (decided && !started) start();
    const onReplay = () => {
      if (!prefersReducedMotionNow()) start();
    };
    window.addEventListener(LEADER_REPLAY_EVENT, onReplay);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener(LEADER_REPLAY_EVENT, onReplay);
    };
  }, []);

  // Drive the countdown by writing straight to the DOM (no re-render per frame).
  useEffect(() => {
    if (phase !== 'count') return;
    const steps = LEADER_FROM - LEADER_TO + 1;
    const total = steps * LEADER_STEP_MS;
    let raf = 0;
    let t0 = -1;
    const frame = (now: number) => {
      if (t0 < 0) t0 = now;
      const elapsed = now - t0;
      const idx = Math.min(steps - 1, Math.floor(elapsed / LEADER_STEP_MS));
      const n = LEADER_FROM - idx;
      if (numRef.current && numRef.current.textContent !== String(n)) numRef.current.textContent = String(n);
      const frac = Math.min(1, (elapsed % LEADER_STEP_MS) / LEADER_STEP_MS);
      sweepRef.current?.style.setProperty('--sweep', `${(frac * 360).toFixed(1)}deg`);
      if (tcRef.current) {
        const frames = Math.floor((elapsed / 1000) * 24);
        tcRef.current.textContent = `TC 00:00:${String(Math.floor(frames / 24)).padStart(2, '0')}:${String(frames % 24).padStart(2, '0')}`;
      }
      if (elapsed >= total) setPhase('flash');
      else raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  useEffect(() => {
    if (phase === 'flash') {
      const t = setTimeout(() => setPhase('out'), LEADER_FLASH_MS);
      return () => clearTimeout(t);
    }
    if (phase === 'out') {
      const t = setTimeout(() => setPhase('idle'), LEADER_LIFT_MS);
      return () => clearTimeout(t);
    }
  }, [phase]);

  // Any key skips. The key still does its normal job (we never preventDefault).
  useEffect(() => {
    if (phase === 'idle') return;
    const onKey = () => setPhase('idle');
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [phase]);

  if (phase === 'idle') return null;

  return (
    <div className="gl-leader" data-state={phase} aria-hidden="true" data-testid="leader" onClick={skip}>
      <span className="gl-leader__corner gl-leader__corner--tl" />
      <span className="gl-leader__corner gl-leader__corner--tr" />
      <span className="gl-leader__corner gl-leader__corner--bl" />
      <span className="gl-leader__corner gl-leader__corner--br" />
      <span className="gl-leader__tc" ref={tcRef}>
        TC 00:00:00:00
      </span>
      <div className="gl-leader__frame">
        <svg className="gl-leader__marks" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="41" />
          <circle cx="50" cy="50" r="34" />
          <path d="M50 0v100M0 50h100" />
        </svg>
        <span className="gl-leader__sweep" ref={sweepRef} />
        <span className="gl-leader__num" ref={numRef}>
          {LEADER_FROM}
        </span>
        <p className="gl-leader__meta">
          <span>{APP_NAME}</span>
          <b>Picture start</b>
          <span>Roll {LAUNCH_DATE.slice(0, 4)} · 24 fps</span>
        </p>
      </div>
      <button type="button" tabIndex={-1} className="gl-leader__skip" onClick={skip}>
        Skip
      </button>
    </div>
  );
}
