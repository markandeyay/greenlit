// Classic (daily, vault, pitch, unlimited) to ShareArtifact. Verdicts only: the grid is the same
// 8-cell rows as the Section 7.1 share text, and the stat is the take count.
import { COPY } from '@/config/brand';
import { RULES } from '@/config/rules';
import { dateForPuzzleNumber } from '@/lib/dates';
import type { ArtifactCell, ShareArtifact } from './artifact';
import { buildArtifact, checkArtifactCard, type ArtifactCard } from './artifactCodec';
import { gridFromInput, type ShareGrid } from './shareGrid';
import { buildShareText, shareUrl } from './shareText';
import type { ShareInput } from './types';

/** The card fields for a classic verdict grid (also used by /api/og/result). */
export function classicCard(grid: ShareGrid): ArtifactCard {
  const won = grid.status === 'won';
  const reel = grid.kind === 'daily' || grid.kind === 'vault' ? grid.reelNumber : null;
  const date = reel !== null ? dateForPuzzleNumber(reel) : null;
  const card: ArtifactCard = {
    mode: grid.kind,
    reelNumber: reel,
    // Absurd reel numbers (a hand-made /api/og/result link) just drop the date.
    date: date && /^2\d{3}-/.test(date) ? date : null,
    outcome: won ? 'won' : 'lost',
    stat: `${won ? grid.rows.length : 'X'}/${RULES.maxGuesses}`,
    statCaption: won ? 'takes' : COPY.lossStamp.toLowerCase(),
    grid: grid.rows.map((row) => row.map((c): ArtifactCell => c)),
  };
  if (grid.hintsUsed) card.hinted = true;
  const check = checkArtifactCard(card);
  if (!check.ok) throw new Error(`classic card: ${check.error}`);
  return card;
}

/** Build the share artifact for a finished classic play. */
export function classicArtifact(input: ShareInput): ShareArtifact {
  const card = classicCard(gridFromInput(input));
  return buildArtifact({ ...card, url: shareUrl(input), text: buildShareText(input) });
}
