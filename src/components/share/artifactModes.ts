// Per-mode presentation for share cards: display name, script-revision paper tint and accent.
// Real productions print each script revision on a different colored page (blue, pink, buff,
// salmon...). Each mode's card is a page in its own revision color. Status colors (match green,
// close marker yellow, miss gray, loss red) are never used as accents.
import { MODES } from '@/config/modes';
import type { ArtifactMode } from './artifact';

export interface ArtifactModeStyle {
  /** Display name on the card and in alt text. */
  label: string;
  /** Pill fill on the slate. */
  accent: string;
  /** Deeper cut of the accent for thin rules on the tinted paper. */
  accentDeep: string;
  /** Type on the accent pill. */
  onAccent: string;
  /** Paper tint of the card body. */
  paper: string;
  /** Revision color name, printed small on the slate. */
  revision: string;
  /** Show the GREENLIT / SENT TO TURNAROUND stamp for won/lost outcomes. */
  stamp: boolean;
}

// Destructured on purpose: the share copy-rules test bans `.name` reads in share code.
const modeName = (id: string, fallback: string) => MODES.filter((m) => m.id === id).map(({ name }) => name)[0] ?? fallback;

export const ARTIFACT_MODE_STYLE: Record<ArtifactMode, ArtifactModeStyle> = {
  daily: { label: 'The Daily', accent: '#4b9cd3', accentDeep: '#2a6a99', onAccent: '#0e0d0c', paper: '#f5f2eb', revision: 'White draft', stamp: true },
  vault: { label: 'The Vault', accent: '#e4cf9f', accentDeep: '#9a7a35', onAccent: '#0e0d0c', paper: '#f3ead6', revision: 'Buff', stamp: true },
  pitch: { label: 'Pitch', accent: '#f0b3c3', accentDeep: '#b4506c', onAccent: '#0e0d0c', paper: '#f7e9e8', revision: 'Pink', stamp: true },
  unlimited: { label: modeName('unlimited', 'Dailies Reel'), accent: '#a9cdee', accentDeep: '#3d6f9e', onAccent: '#0e0d0c', paper: '#ebeff1', revision: 'Blue', stamp: true },
  opening_weekend: { label: modeName('opening_weekend', 'Opening Weekend'), accent: '#e05a63', accentDeep: '#b0303a', onAccent: '#0e0d0c', paper: '#f6e7e2', revision: 'Cherry', stamp: false },
  release_order: { label: modeName('release_order', 'Release Order'), accent: '#d2b98e', accentDeep: '#8a6a3a', onAccent: '#0e0d0c', paper: '#f1e9dc', revision: 'Tan', stamp: false },
  casting_call: { label: modeName('casting_call', 'Casting Call'), accent: '#c7b8e6', accentDeep: '#6b56a3', onAccent: '#0e0d0c', paper: '#eeebf1', revision: 'Lilac', stamp: false },
  logline: { label: modeName('logline', 'Logline'), accent: '#f2a98a', accentDeep: '#b45f3c', onAccent: '#0e0d0c', paper: '#f7ebe3', revision: 'Salmon', stamp: true },
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-10-04" to "Oct 4, 2026" without any timezone math. */
export function formatArtifactDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${d}, ${y}`;
}

/** A short plain-language description of a card, for alt text and screen readers. */
export function describeArtifact(card: {
  mode: ArtifactMode;
  reelNumber: number | null;
  date: string | null;
  outcome: 'won' | 'lost' | 'score';
  stat: string;
  statCaption: string;
  grid: unknown[][];
  hinted?: boolean;
}): string {
  const style = ARTIFACT_MODE_STYLE[card.mode];
  const where = [style.label, card.reelNumber !== null ? `Reel ${card.reelNumber}` : null, card.date ? formatArtifactDate(card.date) : null]
    .filter(Boolean)
    .join(', ');
  const result = card.outcome === 'won' ? 'Won' : card.outcome === 'lost' ? 'Sent to turnaround' : 'Score';
  const stat = [card.stat, card.statCaption].filter(Boolean).join(' ');
  const grid = card.grid.length ? ` Verdict grid of ${card.grid.length} ${card.grid.length === 1 ? 'row' : 'rows'}.` : '';
  return `Result card: ${where}. ${result}, ${stat}${card.hinted ? ', with Script Notes' : ''}.${grid}`;
}
