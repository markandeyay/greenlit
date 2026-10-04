// Pure helpers behind /stats (WS7). Client-safe.
import { COPY } from '@/config/brand';
import { RULES } from '@/config/rules';
import type { LocalPlayRecord, LocalStatsFile } from '@/lib/types';

export interface DistributionRow {
  key: string;
  label: string;
  count: number;
  /** 0..1 relative to the largest bucket, for bar width. */
  share: number;
  isTurnaround: boolean;
}

/**
 * Rows for the take distribution: Take 1 to Take RULES.maxGuesses plus the turnaround (loss)
 * bucket. `distribution` is the StatsSummary array (index maxGuesses = turnaround).
 */
export function distributionRows(distribution: readonly number[]): DistributionRow[] {
  const counts = Array.from({ length: RULES.maxGuesses + 1 }, (_, i) => distribution[i] ?? 0);
  const max = Math.max(1, ...counts);
  return counts.map((count, i) => {
    const isTurnaround = i === RULES.maxGuesses;
    return {
      key: isTurnaround ? 'turnaround' : `take-${i + 1}`,
      label: isTurnaround ? turnaroundLabel() : `Take ${i + 1}`,
      count,
      share: count / max,
      isTurnaround,
    };
  });
}

/** "Sent to turnaround" from the loss stamp copy. */
export function turnaroundLabel(): string {
  const s = COPY.lossStamp.toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Merge device and account records. On a clash the earliest finish wins (the first result). */
export function mergeRecords(...lists: Array<readonly LocalPlayRecord[]>): LocalStatsFile {
  const file: LocalStatsFile = { v: 1, records: {} };
  for (const list of lists) {
    for (const r of list) {
      const key = `${r.kind}:${r.ref}`;
      const prev = file.records[key];
      if (!prev || r.finishedAt < prev.finishedAt) file.records[key] = r;
    }
  }
  return file;
}

export function formatAverage(avg: number | null): string {
  return avg === null ? '-' : avg.toFixed(2);
}
