// AA contrast for every token pair used for text (Section 6.7), read from the real tokens.css,
// in both the default and the colorblind palettes.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const css = readFileSync(fileURLToPath(new URL('../../../src/styles/tokens.css', import.meta.url)), 'utf8');

function block(selector: string): string {
  const i = css.indexOf(`${selector} {`);
  if (i < 0) throw new Error(`missing ${selector}`);
  return css.slice(i, css.indexOf('}', i));
}

function hexVars(src: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of src.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\b/g)) out[m[1]!] = m[2]!.toLowerCase();
  return out;
}

const base = hexVars(block(':root'));
const colorblind = { ...base, ...hexVars(block('[data-colorblind="true"]')) };

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

// [foreground, background] pairs that carry text anywhere in the UI.
const TEXT_PAIRS: Array<[string, string]> = [
  ['ink', 'bg'],
  ['ink', 'surface'],
  ['ink', 'surface-2'],
  ['ink-dim', 'bg'],
  ['ink-dim', 'surface'],
  ['ink-dim', 'surface-2'],
  ['bg', 'ink'], // inverted: slate button, call-sheet header, toasts
  ['green-ink', 'green'],
  ['amber-ink', 'amber'],
  ['ink', 'miss'],
  ['red-rec', 'bg'],
  ['red-rec', 'surface'],
];

describe('token contrast (WCAG AA, 4.5:1 for normal text)', () => {
  it('parses every contract token', () => {
    for (const k of ['bg', 'surface', 'surface-2', 'ink', 'ink-dim', 'rule', 'green', 'green-ink', 'amber', 'amber-ink', 'miss', 'red-rec']) {
      expect(base[k], k).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(colorblind.green).not.toBe(base.green);
    expect(colorblind.amber).not.toBe(base.amber);
  });

  for (const [name, palette] of [
    ['default', base],
    ['colorblind', colorblind],
  ] as const) {
    for (const [fg, bg] of TEXT_PAIRS) {
      it(`${name}: --${fg} on --${bg}`, () => {
        const ratio = contrast(palette[fg]!, palette[bg]!);
        expect(ratio, `${fg} on ${bg} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it('the contrast helper matches known values', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 1);
  });
});
