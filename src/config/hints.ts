// Script Notes (hints) configuration (Section 4.8).
import type { HintType } from '@/lib/types';

/** Type labels shown to the player before they choose a note (content stays hidden). */
export const HINT_TYPE_LABELS: Record<HintType, string> = {
  tagline: 'Tagline',
  plot_keywords: 'Plot keywords',
  cast_connection: 'Famous co-star film',
  filmography: "Director's other films",
  awards: 'Awards',
  sequel_status: 'Sequel status',
  decade_vibe: 'Decade vibe',
  first_letter: 'First letter',
  creator_note: "Creator's note",
};

/** Hint types that may never be offered for Note 1 (slot 1). */
export const NOT_IN_SLOT_1: readonly HintType[] = ['first_letter'];
