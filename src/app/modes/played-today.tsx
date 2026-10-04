'use client';
// "Played today ✓" for a daily mode, read from this device's local stats. Nothing on the server
// render, so it never causes a hydration mismatch.
import { useSyncExternalStore } from 'react';
import type { ModeId } from '@/config/modes';
import { dateInResetZone, todayPuzzleNumber } from '@/lib/dates';
import { localKey, readLocalStats } from '@/lib/local-stats';

const subscribe = (cb: () => void) => {
  window.addEventListener('storage', cb);
  return () => window.removeEventListener('storage', cb);
};

/** True when this device finished `mode` today (New York day). Exported for tests. */
export function hasPlayedToday(mode: ModeId, now: Date = new Date()): boolean {
  const file = readLocalStats();
  if (mode === 'classic') return Boolean(file.records[localKey('daily', String(todayPuzzleNumber(now)))]);
  const today = dateInResetZone(now);
  return Object.values(file.records).some((r) => {
    if (r.kind !== mode) return false;
    const d = new Date(r.finishedAt);
    return !Number.isNaN(d.getTime()) && dateInResetZone(d) === today;
  });
}

export function PlayedToday({ mode }: { mode: ModeId }) {
  const done = useSyncExternalStore(
    subscribe,
    () => hasPlayedToday(mode),
    () => false,
  );
  if (!done) return null;
  return (
    <span className="gl-mode__badge" data-done="">
      Played today <span aria-hidden="true">✓</span>
    </span>
  );
}
