// AA contrast for every token pair used for text (Section 6.7), read from the real tokens.css,
// in the default (script paper) and colorblind palettes, plus the .t-ink and .t-navy accent
// sections, which re-scope the surface tokens.
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
const ink = { ...base, ...hexVars(block('.t-ink')) };
const inkColorblind = { ...colorblind, ...hexVars(block('.t-ink')) };
const navy = { ...base, ...hexVars(block('.t-navy')) };

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
  ['bg', 'ink'], // inverted: slate button, chips pressed, toasts, search highlight
  ['green-ink', 'green'],
  ['amber-ink', 'amber'],
  ['miss-ink', 'miss'],
  ['ink-dim', 'surface-2'],
  ['red-rec', 'bg'],
  ['red-rec', 'surface'],
  ['accent-ink', 'bg'],
  ['accent-ink', 'surface'],
  ['accent-ink', 'surface-2'],
];

// Pairs that only exist on the default paper.
const PAPER_PAIRS: Array<[string, string]> = [
  ['red-rec', 'surface-2'],
  ['green-deep', 'bg'],
  ['green-deep', 'surface'],
  ['on-navy', 'navy'], // call-sheet heads
  ['ink', 'revision-blue'], // script notes
  ['ink-dim', 'revision-blue'],
  ['on-ink', 'ink-section'],
  ['on-ink-dim', 'ink-section'],
  ['ink', 'paper-cool'],
  ['ink', 'marker'], // highlighter
];

// Non-text UI (focus ring, accents): WCAG 1.4.11, 3:1.
const UI_PAIRS: Array<[string, string]> = [
  ['accent-ink', 'bg'],
  ['accent-ink', 'surface'],
  ['ink', 'bg'],
];

describe('token contrast (WCAG AA, 4.5:1 for normal text)', () => {
  it('parses every contract token', () => {
    for (const k of ['bg', 'surface', 'surface-2', 'ink', 'ink-dim', 'rule', 'green', 'green-ink', 'amber', 'amber-ink', 'miss', 'red-rec']) {
      expect(base[k], k).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(colorblind.green).not.toBe(base.green);
    expect(colorblind.amber).not.toBe(base.amber);
  });

  it('the default theme is paper, not projector black', () => {
    expect(luminance(base.bg!)).toBeGreaterThan(0.8);
    expect(luminance(base.ink!)).toBeLessThan(0.02);
    expect(luminance(ink.bg!)).toBeLessThan(0.01);
  });

  for (const [name, palette, pairs] of [
    ['default', base, [...TEXT_PAIRS, ...PAPER_PAIRS]],
    ['colorblind', colorblind, [...TEXT_PAIRS, ...PAPER_PAIRS]],
    ['ink section', ink, TEXT_PAIRS],
    ['ink section colorblind', inkColorblind, TEXT_PAIRS],
    ['navy section', navy, TEXT_PAIRS.filter(([f, b]) => !['green-ink', 'amber-ink', 'red-rec'].includes(f) && b !== 'miss')],
  ] as const) {
    for (const [fg, bg] of pairs) {
      it(`${name}: --${fg} on --${bg}`, () => {
        const ratio = contrast(palette[fg]!, palette[bg]!);
        expect(ratio, `${fg} on ${bg} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  for (const [fg, bg] of UI_PAIRS) {
    it(`default: --${fg} on --${bg} is visible as a focus ring (3:1)`, () => {
      expect(contrast(base[fg]!, base[bg]!)).toBeGreaterThanOrEqual(3);
    });
  }

  it('status fills stay distinguishable from the paper they sit on', () => {
    for (const p of [base, colorblind]) {
      // The miss tile is told apart by its glyph and words, but it should still read as a tile.
      expect(contrast(p.miss!, p.surface!)).toBeGreaterThan(1.15);
      expect(contrast(p.green!, p.surface!)).toBeGreaterThan(1.8);
      expect(contrast(p.amber!, p.surface!)).toBeGreaterThan(1.4);
    }
  });

  it('the contrast helper matches known values', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 1);
  });
});
