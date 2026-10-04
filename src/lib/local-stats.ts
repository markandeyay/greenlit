// Local (device) stats persistence, shared by WS5 (writes on finish) and WS7 (reads for /stats).
// Owned by WS0. Client-safe; every storage access is wrapped so private mode never crashes.
import { STORAGE_KEYS, LOSS_SCORE } from '@/config/game';
import { RULES } from '@/config/rules';
import type { LocalPlayRecord, LocalStatsFile, PlayKind } from '@/lib/types';

const EMPTY: LocalStatsFile = { v: 1, records: {} };

export const localKey = (kind: PlayKind, ref: string) => `${kind}:${ref}`;

export function readLocalStats(): LocalStatsFile {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEYS.localStats);
    if (!raw) return { v: 1, records: {} };
    const parsed = JSON.parse(raw) as LocalStatsFile;
    return parsed && parsed.v === 1 && parsed.records ? parsed : { ...EMPTY, records: {} };
  } catch {
    return { v: 1, records: {} };
  }
}

/** Record a finished play. Idempotent per kind+ref (the first finish wins). */
export function recordLocalPlay(record: LocalPlayRecord): void {
  try {
    const file = readLocalStats();
    const key = localKey(record.kind, record.ref);
    if (file.records[key]) return;
    file.records[key] = record;
    globalThis.localStorage?.setItem(STORAGE_KEYS.localStats, JSON.stringify(file));
  } catch {
    /* storage unavailable */
  }
}

export interface StatsSummary {
  played: number;
  wins: number;
  winRate: number; // 0..100
  currentStreak: number; // consecutive daily wins ending at the latest finished daily
  maxStreak: number;
  /** 11 entries: index 0..9 = won in 1..10 takes, index 10 = sent to turnaround. */
  distribution: number[];
  averageTakes: number | null; // loss counts as LOSS_SCORE
  hintedPlays: number;
}

/** Summarize records of one kind (default: daily). Streaks use consecutive reel numbers. */
export function summarize(file: LocalStatsFile, kind: PlayKind = 'daily'): StatsSummary {
  const recs = Object.values(file.records).filter((r) => r.kind === kind);
  const distribution = Array<number>(RULES.maxGuesses + 1).fill(0);
  let wins = 0;
  let total = 0;
  let hinted = 0;
  for (const r of recs) {
    if (r.status === 'won') {
      wins++;
      distribution[Math.min(Math.max(r.takes, 1), RULES.maxGuesses) - 1]! += 1;
      total += r.takes;
    } else {
      distribution[RULES.maxGuesses]! += 1;
      total += LOSS_SCORE;
    }
    if (r.hintsUsed > 0) hinted++;
  }
  // Streaks over numeric refs (reel numbers).
  const byNum = new Map(recs.map((r) => [Number(r.ref), r]));
  const nums = [...byNum.keys()].filter(Number.isFinite).sort((a, b) => a - b);
  let maxStreak = 0;
  let run = 0;
  let prev: number | null = null;
  for (const n of nums) {
    const won = byNum.get(n)!.status === 'won';
    run = won ? (prev !== null && n === prev + 1 && run > 0 ? run + 1 : 1) : 0;
    maxStreak = Math.max(maxStreak, run);
    prev = n;
  }
  return {
    played: recs.length,
    wins,
    winRate: recs.length ? Math.round((wins / recs.length) * 100) : 0,
    currentStreak: run,
    maxStreak,
    distribution,
    averageTakes: recs.length ? Math.round((total / recs.length) * 100) / 100 : null,
    hintedPlays: hinted,
  };
}
