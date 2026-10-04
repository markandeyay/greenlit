// WS8 copy rules: no em dashes, no hardcoded product name, no hardcoded thresholds in UI copy.
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
  return readdirSync(abs, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)]));
}

const WS8_FILES = [
  ...walk('src/app/pitch'),
  ...walk('src/app/admin'),
  ...walk('src/app/api/pitch'),
  ...walk('src/app/api/admin'),
  ...walk('src/components/pitch'),
  ...walk('src/components/admin'),
  ...walk('src/server/admin'),
  'src/server/pitch.ts',
  'src/server/moderation.ts',
  ...walk('scripts/schedule'),
].filter((f) => /\.tsx?$/.test(f));

describe('WS8 copy rules', () => {
  it('finds the files', () => {
    expect(WS8_FILES.length).toBeGreaterThan(20);
  });
  it('has no em dashes', () => {
    expect(WS8_FILES.filter((f) => readFileSync(join(root, f), 'utf8').includes('—'))).toEqual([]);
  });
  it('never hardcodes the product name', () => {
    const re = new RegExp(`['"\`>]\\s*${APP_NAME}\\b`);
    expect(WS8_FILES.filter((f) => re.test(readFileSync(join(root, f), 'utf8')))).toEqual([]);
  });
  it('does not hardcode guess counts or note limits in UI copy', () => {
    const ui = WS8_FILES.filter((f) => f.endsWith('.tsx'));
    expect(ui.filter((f) => /\b(10 takes|140 char|365 days|60 days)\b/.test(readFileSync(join(root, f), 'utf8')))).toEqual([]);
  });
});
