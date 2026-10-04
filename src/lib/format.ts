// Display formatting helpers for the game UI (WS5). Pure and isomorphic. No em dashes in output.
import { formatUsd } from '@/lib/callsheet/format';

export { formatUsd };

/** Box office for a cell: "$1.2B", or "N/A" when unknown. */
export function formatBoxOffice(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? formatUsd(value) : 'N/A';
}

/** Spoken box office: "1.2 billion dollars". */
export function speakBoxOffice(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'not available';
  const units: [number, string][] = [
    [1e9, 'billion'],
    [1e6, 'million'],
    [1e3, 'thousand'],
  ];
  for (const [size, word] of units) {
    if (Math.abs(value) >= size) {
      const x = Math.round((value / size) * 10) / 10;
      return `${String(x).replace(/\.0$/, '')} ${word} dollars`;
    }
  }
  return `${Math.round(value)} dollars`;
}

/** Plain integer for year / score cells; "N/A" when unknown. */
export function formatPlain(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(Math.round(value)) : 'N/A';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parseDate(date: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "2026-10-04" -> "Oct 04 2026" (slate style). Timezone independent. */
export function formatSlateDate(date: string): string {
  const d = parseDate(date);
  if (!d) return date;
  return `${MONTHS[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, '0')} ${d.getUTCFullYear()}`;
}

/** "2026-10-04" -> "Sun, Oct 4, 2026". */
export function formatShortDate(date: string): string {
  const d = parseDate(date);
  if (!d) return date;
  return `${WEEKDAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/** "2026-10-04" -> "October 4, 2026". */
export function formatLongDate(date: string): string {
  const d = parseDate(date);
  if (!d) return date;
  return `${MONTHS_LONG[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/** Zero padded take / scene numbers: 3 -> "03". */
export function pad2(n: number): string {
  return String(Math.max(0, Math.trunc(n))).padStart(2, '0');
}

/** Up to two initials from a name or title, ignoring leading articles: "The Dark Knight" -> "DK". */
export function initials(text: string, max = 2): string {
  const words = text
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const meaningful = words.length > 1 ? words.filter((w) => !/^(the|a|an|of|and|to|in|on|at|for)$/i.test(w)) : words;
  const letters = (meaningful.length ? meaningful : words).map((w) => w[0]!.toUpperCase());
  return letters.slice(0, max).join('') || '?';
}

/** Small deterministic hash for picking fallback art variants. */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 0..100 rounded percentage; 0 when the total is 0. */
export function percent(part: number, total: number): number {
  if (!total || total <= 0) return 0;
  return Math.round((part / total) * 100);
}

/** "1 take" / "3 takes". */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
