// Share contract (WS0). WS5's ResultCard renders <ShareSheet {...ShareSheetProps} />; WS6 owns the
// implementation and may add optional props but must keep these.
import type { ClassicKind, GuessFeedback } from '@/lib/types';

export interface ShareInput {
  kind: ClassicKind;
  ref: string; // puzzle number or pitch slug
  reelNumber: number | null; // null for pitches
  feedback: GuessFeedback[]; // oldest first
  status: 'won' | 'lost';
  hintsUsed: number;
}

export type ShareSheetProps = ShareInput & { className?: string };
