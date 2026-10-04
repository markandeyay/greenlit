// Server-only renderer shared by src/app/opengraph-image.tsx and twitter-image.tsx.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { APP_NAME, APP_TAGLINE } from '@/config/brand';
import { todayPuzzleNumber } from '@/lib/dates';
import { DailyImage } from './DailyImage';
import { OG_SIZE } from './ogTheme';

export const DAILY_IMAGE_ALT = `${APP_NAME}. ${APP_TAGLINE}`;

let grainPromise: Promise<string | null> | null = null;

/** The film-grain texture as a data URI, read once per server instance. */
function loadGrain(): Promise<string | null> {
  grainPromise ??= readFile(join(process.cwd(), 'public/og/grain.png'), 'base64')
    .then((b64) => `data:image/png;base64,${b64}`)
    .catch(() => null);
  return grainPromise;
}

export async function renderDailyImage(now: Date = new Date()): Promise<ImageResponse> {
  const n = todayPuzzleNumber(now);
  const grainSrc = await loadGrain();
  return new ImageResponse(<DailyImage reelNumber={n >= 1 ? n : null} grainSrc={grainSrc} />, { ...OG_SIZE });
}

/**
 * Vault card: "Reel N" from the URL. Only a released reel number (1..today) is printed; anything
 * else renders the generic card. A reel number reveals nothing about its answer.
 */
export async function renderVaultImage(raw: string, now: Date = new Date()): Promise<ImageResponse> {
  const today = todayPuzzleNumber(now);
  const n = /^[1-9][0-9]{0,5}$/.test(raw) ? Number(raw) : NaN;
  const reel = Number.isInteger(n) && n >= 1 && n <= today ? n : null;
  const grainSrc = await loadGrain();
  return new ImageResponse(<DailyImage reelNumber={reel} grainSrc={grainSrc} kicker="From the Vault" />, {
    ...OG_SIZE,
  });
}

/** Pitch card: generic, independent of the slug (the slug never appears in the image). */
export async function renderPitchImage(): Promise<ImageResponse> {
  const grainSrc = await loadGrain();
  return new ImageResponse(<DailyImage reelNumber={null} grainSrc={grainSrc} kicker="You have been pitched a film" />, {
    ...OG_SIZE,
  });
}
