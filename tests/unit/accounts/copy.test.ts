// Copy rules over WS7 files: no em dashes, no hardcoded product name in UI code.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { APP_NAME } from '@/config/brand';

const root = fileURLToPath(new URL('../../../', import.meta.url));

function walk(dir: string): string[] {
  const abs = join(root, dir);
  try {
    if (statSync(abs).isFile()) return [dir];
  } catch {
    return [];
  }
  return readdirSync(abs, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)],
  );
}

const FILES = [
  'src/app/stats',
  'src/app/leaderboard',
  'src/app/settings',
  'src/app/auth',
  'src/components/account',
  'src/components/stats',
  'src/components/leaderboard',
  'src/server/leaderboard.ts',
  'src/server/profile.ts',
].flatMap(walk);

describe('copy rules (WS7 files)', () => {
  it('finds the files', () => {
    expect(FILES.length).toBeGreaterThan(10);
  });

  it('contains no em dashes', () => {
    expect(FILES.filter((f) => readFileSync(join(root, f), 'utf8').includes('—'))).toEqual([]);
  });

  it('never hardcodes the product name', () => {
    const re = new RegExp(`\\b${APP_NAME}\\b`);
    expect(FILES.filter((f) => re.test(readFileSync(join(root, f), 'utf8')))).toEqual([]);
  });
});
