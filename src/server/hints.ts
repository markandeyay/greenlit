// Script Notes (Section 4.8, 9.1 item 4). SERVER ONLY.
//
// Decisions:
// - Slot 1 unlocks at takes >= RULES.hintUnlockAfter[0], slot 2 at >= RULES.hintUnlockAfter[1].
// - Options are the target's candidate TYPES minus types already used. Slot 1 never offers
//   NOT_IN_SLOT_1 (first_letter). Locked or already-used slots return [] (labels are not
//   previewed before unlock).
// - Slot 2 requires slot 1 to have been used first, so plays.hints_used stays dense
//   ([slot1] or [slot1, slot2]). At take 8+ a player who skipped Note 1 simply takes both.
// - Pitches: slot 1 offers ['creator_note'] once takes >= PITCH.noteUnlockAfter and the pitch
//   has a note. Slot 2 offers nothing.
// - New hints are only granted while the play is in progress. Re-requesting a hint already used
//   in that slot (same type) returns its content any time, so a resumed or finished play can
//   redisplay it.
import 'server-only';
import { RULES } from '@/config/rules';
import { PITCH } from '@/config/game';
import { NOT_IN_SLOT_1 } from '@/config/hints';
import { ApiFailure } from '@/server/http';
import { resolveTarget, type ResolvedTarget } from '@/server/puzzles';
import { hintContent, loadPlay, newPlay, savePlay, type Identity } from '@/server/plays';
import type { HintOptionsResponse, HintResponse, HintSlot, HintType, Play, PlayKind } from '@/lib/types';

export function slotThreshold(kind: PlayKind, slot: HintSlot): number {
  if (kind === 'pitch') return slot === 1 ? PITCH.noteUnlockAfter : Infinity;
  return RULES.hintUnlockAfter[slot - 1]!;
}

/** Hint options for a play state. Pure; exported for tests. */
export function computeHintOptions(target: ResolvedTarget, play: Play | null): HintOptionsResponse {
  const empty: HintOptionsResponse = { slot1: [], slot2: [] };
  if (play && play.status !== 'in_progress') return empty;
  const takes = play?.guesses.length ?? 0;
  const used = play?.hintsUsed ?? [];

  if (target.kind === 'pitch') {
    const hasNote = target.hints.some((h) => h.type === 'creator_note');
    const slot1: HintType[] = hasNote && !used[0] && takes >= PITCH.noteUnlockAfter ? ['creator_note'] : [];
    return { slot1, slot2: [] };
  }

  const candidates = [...new Set(target.hints.map((h) => h.type))].filter(
    (t) => t !== 'creator_note' && !used.includes(t),
  );
  const slot1 =
    !used[0] && takes >= slotThreshold(target.kind, 1) ? candidates.filter((t) => !NOT_IN_SLOT_1.includes(t)) : [];
  const slot2 = used[0] && !used[1] && takes >= slotThreshold(target.kind, 2) ? candidates : [];
  return { slot1, slot2 };
}

export async function getHintOptions(
  identity: Identity,
  kind: PlayKind,
  rawRef: string,
  now: Date = new Date(),
): Promise<HintOptionsResponse> {
  const target = await resolveTarget(kind, rawRef, now);
  const play = await loadPlay(identity, kind, target.ref);
  return computeHintOptions(target, play);
}

export async function revealHint(
  identity: Identity,
  kind: PlayKind,
  rawRef: string,
  slot: HintSlot,
  hintType: HintType,
  now: Date = new Date(),
): Promise<HintResponse> {
  const target = await resolveTarget(kind, rawRef, now);
  const play = (await loadPlay(identity, kind, target.ref)) ?? newPlay(identity, kind, target.ref, now);
  const idx = slot - 1;

  // Already used in this slot: redisplay (resume), whatever the play status.
  if (play.hintsUsed[idx] === hintType) {
    const hint = hintContent(target, hintType);
    if (!hint) throw new ApiFailure('hint_unavailable', 'That note is not available.');
    return { hint };
  }
  if (play.status !== 'in_progress') throw new ApiFailure('game_over', 'This round is already over.');

  const takes = play.guesses.length;
  if (takes < slotThreshold(kind, slot)) {
    throw new ApiFailure('hint_locked', `Note ${slot} is still locked. Keep rolling.`);
  }
  if (play.hintsUsed[idx]) throw new ApiFailure('hint_unavailable', `Note ${slot} has already been used.`);
  if (slot === 2 && !play.hintsUsed[0]) throw new ApiFailure('hint_locked', 'Open Note 1 before Note 2.');

  const options = computeHintOptions(target, play);
  const allowed = slot === 1 ? options.slot1 : options.slot2;
  if (!allowed.includes(hintType)) throw new ApiFailure('hint_unavailable', 'That note is not available.');
  const hint = hintContent(target, hintType);
  if (!hint) throw new ApiFailure('hint_unavailable', 'That note is not available.');

  play.hintsUsed[idx] = hintType;
  await savePlay(play, identity);
  return { hint };
}
