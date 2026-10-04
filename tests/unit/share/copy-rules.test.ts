// Copy and leak rules over every WS6 file: no em dashes, no hardcoded product name, no hardcoded
// take limit, and no answer fields read by the share layer.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { APP_NAME } from '@/config/brand';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const walk = (dir: string): string[] =>
  readdirSync(join(root, dir), { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)],
  );

const FILES = [
  ...walk('src/components/share'),
  ...walk('src/app/api/og'),
  ...walk('src/app/api/share'),
  'src/app/opengraph-image.tsx',
  'src/app/twitter-image.tsx',
  'src/app/vault/[number]/opengraph-image.tsx',
  'src/app/p/[slug]/opengraph-image.tsx',
];
const read = (f: string) => readFileSync(join(root, f), 'utf8');
/** Code only: drops // line comments and JSDoc / block comment lines. */
const code = (f: string) => read(f).replace(/^\s*(\/\/|\/\*|\*).*$/gm, '');

describe('copy rules (WS6 files)', () => {
  it('finds the files', () => {
    expect(FILES.length).toBeGreaterThanOrEqual(12);
  });

  it('contains no em dashes', () => {
    expect(FILES.filter((f) => read(f).includes('—'))).toEqual([]);
  });

  it('never hardcodes the product name in code', () => {
    expect(FILES.filter((f) => new RegExp(`['"\`>]\\s*${APP_NAME}\\b`).test(read(f)))).toEqual([]);
  });

  it('never hardcodes the take limit', () => {
    expect(FILES.filter((f) => /\/10\b|maxGuesses:\s*10/.test(code(f)))).toEqual([]);
  });

  it('never reads answer-identifying fields', () => {
    const forbidden = /\.(title|filmId|posterPath|personIds|personId)\b|\.name\b(?!\s*===)/;
    const offenders = FILES.filter((f) => !f.endsWith('.png') && forbidden.test(code(f)));
    expect(offenders).toEqual([]);
  });
});
