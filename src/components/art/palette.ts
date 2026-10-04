// Deterministic palettes and motif picks for the designed poster and portrait art.
//
// Seeding: art is seeded from the film TITLE (and the person NAME), not the database id. Several
// wire types carry no id on purpose (GuessFeedback, Reveal, and Release Order cards, which hide
// ids so the order cannot be looked up), so seeding by title is the only way the same film looks
// the same on every surface. The seed never includes the year: Release Order hides it until the
// round ends, and the art must not change (or hint) when it is revealed.
import { hashString } from '@/lib/format';

export interface FilmPalette {
  name: string;
  /** The paper the poster is printed on. Title and small type sit on this. */
  ground: string;
  /** Title, monogram, year and kicker. AA (>= 4.5:1) on `ground`, checked in tests. */
  ink: string;
  /** Main motif color. */
  a: string;
  /** Secondary motif color. */
  b: string;
}

/**
 * Fourteen duotone/tritone schemes from the script paper family: paper, navy, Carolina, ink,
 * marker yellow, warm reds, forest greens, muted teals. No neon, no black + orange.
 */
export const FILM_PALETTES: readonly FilmPalette[] = [
  { name: 'carolina-paper', ground: '#f2ece0', ink: '#13294b', a: '#4b9cd3', b: '#c4473a' },
  { name: 'navy-night', ground: '#13294b', ink: '#f5f2eb', a: '#4b9cd3', b: '#f2c14e' },
  { name: 'marker', ground: '#f2c14e', ink: '#1a1714', a: '#c4382b', b: '#13294b' },
  { name: 'brick', ground: '#9e3328', ink: '#fbf1e2', a: '#f0c674', b: '#5c1a14' },
  { name: 'forest', ground: '#1f4a36', ink: '#f1ead8', a: '#a9c49b', b: '#e3b04b' },
  { name: 'teal', ground: '#24575b', ink: '#f4ede0', a: '#8ec5c0', b: '#e07a5f' },
  { name: 'projector', ground: '#1c1916', ink: '#f5f2eb', a: '#c4382b', b: '#e9e1d0' },
  { name: 'sky', ground: '#9acbeb', ink: '#13294b', a: '#f5f2eb', b: '#1e3a66' },
  { name: 'blush', ground: '#f1d7c8', ink: '#5a1d1a', a: '#c4473a', b: '#24575b' },
  { name: 'sage', ground: '#d3dcc7', ink: '#1f3a2c', a: '#4f7c5d', b: '#c4473a' },
  { name: 'oxblood', ground: '#4a1a1e', ink: '#f3dcb5', a: '#c4473a', b: '#e8b65a' },
  { name: 'slate-blue', ground: '#2d4f7c', ink: '#f5f2eb', a: '#9acbeb', b: '#e8b65a' },
  { name: 'cream-teal', ground: '#efe7d4', ink: '#173f42', a: '#3f8a86', b: '#d9583b' },
  { name: 'mustard', ground: '#d9a441', ink: '#1a1714', a: '#f5ecd9', b: '#1e3a66' },
];

export interface PersonPalette {
  name: string;
  ground: string;
  /** The portrait silhouette, a tone close to the ground. */
  tone: string;
  /** Initials. AA on both `ground` and `tone`, checked in tests. */
  ink: string;
}

/**
 * Warm portrait grounds. No greens or marker yellow: headshots sit next to verdict colors, and a
 * green or yellow tile must never read as a match or a close.
 */
export const PERSON_PALETTES: readonly PersonPalette[] = [
  { name: 'paper', ground: '#efe6d6', tone: '#e2d4bb', ink: '#1a1714' },
  { name: 'carolina', ground: '#c4ddef', tone: '#a9cde9', ink: '#13294b' },
  { name: 'navy', ground: '#1e3a66', tone: '#2b4d80', ink: '#f5f2eb' },
  { name: 'brick', ground: '#a3392d', tone: '#8e3027', ink: '#fbf3e6' },
  { name: 'rose', ground: '#efcfc1', tone: '#e4b9a7', ink: '#4a1c1f' },
  { name: 'teal', ground: '#24575b', tone: '#30686c', ink: '#f5efe2' },
  { name: 'oxblood', ground: '#4a1c1f', tone: '#5d2a2c', ink: '#f2dcc0' },
  { name: 'sand', ground: '#e6d3ae', tone: '#d9c296', ink: '#2b1f12' },
  { name: 'slate', ground: '#3d4a5c', tone: '#4b5a6f', ink: '#f5f2eb' },
  { name: 'ink', ground: '#26221e', tone: '#36312b', ink: '#f5f2eb' },
];

export const MOTIFS = [
  'sun',
  'stripes',
  'filmstrip',
  'halftone',
  'arch',
  'split',
  'spotlight',
  'rings',
  'eclipse',
  'waves',
  'windows',
  'peaks',
] as const;
export type Motif = (typeof MOTIFS)[number];

/** Title layouts: centered under the motif, a left-set justified stack, or the title on top. */
export const LAYOUTS = ['center', 'stack', 'top'] as const;
export type Layout = (typeof LAYOUTS)[number];

/** Normalized seed text: case, punctuation and spacing do not change the art. */
export function seedOf(text: string): string {
  return text
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export interface FilmArtPick {
  palette: FilmPalette;
  paletteIndex: number;
  motif: Motif;
  layout: Layout;
  /** Extra deterministic entropy for motif parameters (angles, counts, offsets). */
  variant: number;
}

export function pickFilmArt(title: string): FilmArtPick {
  const s = seedOf(title);
  const paletteIndex = hashString(`palette:${s}`) % FILM_PALETTES.length;
  return {
    palette: FILM_PALETTES[paletteIndex]!,
    paletteIndex,
    motif: MOTIFS[hashString(`motif:${s}`) % MOTIFS.length]!,
    layout: LAYOUTS[hashString(`layout:${s}`) % LAYOUTS.length]!,
    variant: hashString(`variant:${s}`),
  };
}

export function pickPersonPalette(name: string): PersonPalette {
  return PERSON_PALETTES[hashString(`person:${seedOf(name)}`) % PERSON_PALETTES.length]!;
}

/** A small seeded PRNG (mulberry32) for motif parameters. Same seed, same sequence. */
export function rng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---- Contrast (WCAG 2.x) -------------------------------------------------------------- */

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? [...h].map((c) => c + c).join('') : h, 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Mix two hex colors: t = 0 gives `a`, t = 1 gives `b`. */
export function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.replace('#', ''), 16);
  const pb = parseInt(b.replace('#', ''), 16);
  const ch = (s: number) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}

/** The studio key light on a portrait ground: a lighter tint (AA with the initials, tested). */
export function keyLight(p: PersonPalette): string {
  return mix(p.ground, '#ffffff', luminance(p.ground) > 0.4 ? 0.38 : 0.09);
}
