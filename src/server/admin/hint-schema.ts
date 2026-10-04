// zod schema for hand-edited Script Notes (admin). Mirrors the Hint union in src/lib/types.ts.
import { z } from 'zod';
import type { Hint } from '@/lib/types';

const text = z.string().trim().min(1).max(200);
const title = z.string().trim().min(1).max(200);
const year = z.number().int().min(1870).max(2200);

export const hintSchema: z.ZodType<Hint> = z.discriminatedUnion('type', [
  z.object({ type: z.literal('tagline'), payload: z.object({ text }) }),
  z.object({ type: z.literal('plot_keywords'), payload: z.object({ keywords: z.array(z.string().trim().min(1).max(60)).min(3).max(5) }) }),
  z.object({ type: z.literal('cast_connection'), payload: z.object({ personName: title, filmTitle: title, filmYear: year }) }),
  z.object({ type: z.literal('filmography'), payload: z.object({ films: z.array(z.object({ title, year })).min(1).max(5) }) }),
  z.object({ type: z.literal('awards'), payload: z.object({ text }) }),
  z.object({ type: z.literal('sequel_status'), payload: z.object({ text }) }),
  z.object({ type: z.literal('decade_vibe'), payload: z.object({ text }) }),
  z.object({ type: z.literal('first_letter'), payload: z.object({ letter: z.string().trim().min(1).max(2) }) }),
  z.object({ type: z.literal('creator_note'), payload: z.object({ text }) }),
]);

export const hintsArraySchema = z.array(hintSchema);
