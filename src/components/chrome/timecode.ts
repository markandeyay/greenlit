// Timecode math for the chrome (Section 6.1): HH:MM:SS:FF at 24 fps. Pure.

export const FPS = 24;

const pad = (n: number) => String(n).padStart(2, '0');

/** Milliseconds to "HH:MM:SS:FF" at `fps`. Negative values clamp to zero. Hours can exceed 23. */
export function formatTimecode(ms: number, fps: number = FPS): string {
  const safe = Number.isFinite(ms) && ms > 0 ? ms : 0;
  const totalFrames = Math.floor((safe * fps) / 1000);
  const ff = totalFrames % fps;
  const totalSeconds = Math.floor(totalFrames / fps);
  const ss = totalSeconds % 60;
  const mm = Math.floor(totalSeconds / 60) % 60;
  const hh = Math.floor(totalSeconds / 3600);
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}:${pad(ff)}`;
}

/** Spoken form at minute granularity: "13 hours 42 minutes". Under a minute: "less than a minute". */
export function describeRemaining(ms: number): string {
  const totalMinutes = Math.floor(Math.max(0, ms) / 60000);
  if (totalMinutes < 1) return 'less than a minute';
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h} ${h === 1 ? 'hour' : 'hours'}`);
  if (m > 0) parts.push(`${m} ${m === 1 ? 'minute' : 'minutes'}`);
  return parts.join(' ');
}

/** Reel code used in breadcrumbs and edge print: 212 -> "212A". */
export function reelCode(n: number, take: string = 'A'): string {
  return `${String(Math.max(0, Math.trunc(n))).padStart(3, '0')}${take}`;
}

/** "Roll 2026 · Reel 212 · Sc 01 · Tk 04" (missing parts are skipped). */
export function formatSlateMeta(parts: {
  roll?: string | number;
  reel?: number;
  scene?: number;
  take?: number;
}): string {
  const out: string[] = [];
  if (parts.roll !== undefined) out.push(`Roll ${parts.roll}`);
  if (parts.reel !== undefined) out.push(`Reel ${String(parts.reel).padStart(3, '0')}`);
  if (parts.scene !== undefined) out.push(`Sc ${pad(parts.scene)}`);
  if (parts.take !== undefined) out.push(`Tk ${pad(parts.take)}`);
  return out.join(' · ');
}
