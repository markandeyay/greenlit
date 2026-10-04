// Shared route plumbing for /api/modes/casting-call/*. SERVER ONLY.
import 'server-only';
import { z } from 'zod';
import { json } from '@/server/http';
import { stateCookieHeader, type EngineResult } from './engine';

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const idSchema = z.number().int().positive().max(2_147_483_647);

export const linkSchema = z.object({ date: dateSchema, filmId: idSchema, personId: idSchema });
export const giveUpSchema = z.object({ date: dateSchema });

/** JSON state response, with the refreshed state token cookie when there is one. */
export function stateResponse(result: EngineResult): Response {
  const res = json(result.state);
  if (result.token) res.headers.append('Set-Cookie', stateCookieHeader(result.token));
  return res;
}
