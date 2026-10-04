// Puzzle calendar math (Section 4.10). Pure and isomorphic: safe on server and client.
// All "dates" are YYYY-MM-DD strings in RESET_TIMEZONE (America/New_York).
import { LAUNCH_DATE, RESET_TIMEZONE } from '@/config/game';

const DAY_MS = 86_400_000;

/** YYYY-MM-DD of `now` in America/New_York. */
export function dateInResetZone(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: RESET_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function dateToUtcMs(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y!, m! - 1, d!);
}

export function addDays(date: string, days: number): string {
  return new Date(dateToUtcMs(date) + days * DAY_MS).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((dateToUtcMs(to) - dateToUtcMs(from)) / DAY_MS);
}

/** Reel No. for a date: days since launch + 1. Returns < 1 for pre-launch dates. */
export function puzzleNumberForDate(date: string, launch: string = LAUNCH_DATE): number {
  return daysBetween(launch, date) + 1;
}

export function dateForPuzzleNumber(n: number, launch: string = LAUNCH_DATE): string {
  return addDays(launch, n - 1);
}

export function todayPuzzleNumber(now: Date = new Date()): number {
  return puzzleNumberForDate(dateInResetZone(now));
}

/** Offset of RESET_TIMEZONE from UTC at a given instant, in minutes (e.g. -240 for EDT). */
function zoneOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: RESET_TIMEZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60_000);
}

/** The instant of the next 00:00 in America/New_York after `now`. DST-safe. */
export function nextResetAt(now: Date = new Date()): Date {
  const tomorrow = addDays(dateInResetZone(now), 1);
  const guess = new Date(dateToUtcMs(tomorrow));
  // Midnight local = midnight UTC minus the zone offset at that moment.
  let instant = new Date(guess.getTime() - zoneOffsetMinutes(guess) * 60_000);
  // Re-check once in case the offset differs across a DST boundary.
  instant = new Date(guess.getTime() - zoneOffsetMinutes(instant) * 60_000);
  return instant;
}
