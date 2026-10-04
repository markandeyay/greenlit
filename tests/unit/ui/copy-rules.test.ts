// Global copy rules over every WS4 file: no em dashes, no hardcoded product name in UI, and
// no hardcoded rule thresholds in How to play.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { APP_NAME } from '@/config/brand';

const root = fileURLToPath(new URL('../../../', import.meta.url));

function walk(dir: string): string[] {
  const abs = join(root, dir);
  try {
    statSync(abs);
  } catch {
    return [];
  }
  return readdirSync(abs, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)],
  );
}

const FILES = [
  ...walk('src/styles'),
  ...walk('src/components/chrome'),
  ...walk('src/components/ui'),
  ...walk('src/app/how-to-play'),
  ...walk('src/app/dev'),
  ...walk('src/app/modes'),
  'src/app/layout.tsx',
  'src/app/not-found.tsx',
  'src/app/icon.svg',
  'src/lib/settings.ts',
].filter((f) => /\.(tsx?|css|svg|md)$/.test(f));

describe('copy rules (WS4 files)', () => {
  it('finds the files', () => {
    expect(FILES.length).toBeGreaterThan(20);
  });

  it('contains no em dashes anywhere', () => {
    const offenders = FILES.filter((f) => readFileSync(join(root, f), 'utf8').includes('—'));
    expect(offenders).toEqual([]);
  });

  it('never hardcodes the product name in UI code', () => {
    const offenders = FILES.filter(
      (f) => /\.tsx?$/.test(f) && new RegExp(`['"\`>]\\s*${APP_NAME}\\b`).test(readFileSync(join(root, f), 'utf8')),
    );
    expect(offenders).toEqual([]);
  });

  it('How to play reads thresholds from RULES', () => {
    const src = readFileSync(join(root, 'src/app/how-to-play/page.tsx'), 'utf8');
    expect(src).toContain('RULES.maxGuesses');
    expect(src).toContain('RULES.yearClose');
    expect(src).toContain('RULES.boxOfficeGreenPct');
    expect(src).toContain('RULES.boxOfficeCloseRatio');
    expect(src).toContain('RULES.scoreClose');
    expect(src).toContain('RULES.maxSupportingCast');
    expect(src).toContain('RULES.hintUnlockAfter');
    expect(src).not.toMatch(/\b10 (guesses|takes)\b/);
  });
});
