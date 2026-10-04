// Share artifact contract (WS0, design brief v2 principle 8). Every mode ends with a result card that
// is exactly what gets shared: a spoiler-free PNG (portrait 1080x1350, plus 1200x630) and emoji text.
// The share agent implements the panel and the image route; mode screens build a ShareArtifact.
//
// SPOILER RULE: an artifact must never contain a film title, poster, person name, year, gross, or
// any answer data. Only mode name, date, scores and verdict grids. The image route validates this
// shape strictly and rejects free text beyond the allowed fields.

export type ArtifactMode =
  | 'daily'
  | 'vault'
  | 'pitch'
  | 'unlimited'
  | 'opening_weekend'
  | 'release_order'
  | 'casting_call'
  | 'logline';

export type ArtifactCell = 'match' | 'close' | 'miss' | 'empty';

export interface ShareArtifact {
  mode: ArtifactMode;
  /** Reel number for daily/vault, else null. */
  reelNumber: number | null;
  /** YYYY-MM-DD (New York) for daily modes, else null. */
  date: string | null;
  outcome: 'won' | 'lost' | 'score';
  /** The big number on the card, e.g. "3/10", "12", "2/3", "3 films". Max 12 chars. */
  stat: string;
  /** Small caption under the stat, e.g. "takes", "in a row", "optimal 2". Max 24 chars. */
  statCaption: string;
  /** Spoiler-free verdict rows (max 10 rows x 10 cells). Empty array if the mode has no grid. */
  grid: ArtifactCell[][];
  /** True when hints (Script Notes) were used. */
  hinted?: boolean;
  /** Absolute share URL (no answer data, no opaque play refs for unlimited). */
  url: string;
  /** Full emoji share text (Wordle style), already built by the mode. */
  text: string;
}

export interface ShareArtifactPanelProps {
  artifact: ShareArtifact;
  className?: string;
  /** Optional heading above the card, e.g. "Post your take". */
  heading?: string;
}
