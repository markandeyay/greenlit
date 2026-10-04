// zod schemas for game route inputs (Section 9).
import { z } from 'zod';
import { HINT_TYPE_LABELS } from '@/config/hints';
import type { HintType, PlayKind } from '@/lib/types';

export const PLAY_KINDS = ['daily', 'vault', 'pitch', 'unlimited'] as const satisfies readonly PlayKind[];
export const HINT_TYPES = Object.keys(HINT_TYPE_LABELS) as [HintType, ...HintType[]];

export const kindSchema = z.enum(PLAY_KINDS);
// Puzzle numbers, 8 char pitch slugs, keyless-mode opaque pitch tokens (base64url, 9.1 item 17),
// or opaque unlimited reel refs (9.1 item 19).
export const refSchema = z.string().trim().min(1).max(512);

export const targetSchema = z.object({ kind: kindSchema, ref: refSchema });

export const guessSchema = z.object({
  kind: kindSchema,
  ref: refSchema,
  filmId: z.number().int().positive().max(2_147_483_647),
});

export const giveUpSchema = targetSchema;

export const hintSchema = z.object({
  kind: kindSchema,
  ref: refSchema,
  slot: z.union([z.literal(1), z.literal(2)]),
  hintType: z.enum(HINT_TYPES),
});
