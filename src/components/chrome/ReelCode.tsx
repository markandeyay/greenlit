'use client';
import { COPY } from '@/config/brand';
import { todayPuzzleNumber } from '@/lib/dates';
import { useIsClient } from '@/components/ui/useIsClient';

/**
 * Today's reel number ("Reel No. 004"), computed on the client after mount so a statically
 * rendered shell never shows yesterday's number. Placeholder keeps the width.
 */
export function ReelCode({ format = COPY.reelLabel, className }: { format?: (n: number) => string; className?: string }) {
  const isClient = useIsClient();
  // Date read only after mount, so server and hydration renders agree.
  const n = isClient ? Math.max(1, todayPuzzleNumber()) : null;
  return <span className={className}>{n === null ? format(0).replace(/\d/g, '-') : format(n)}</span>;
}
