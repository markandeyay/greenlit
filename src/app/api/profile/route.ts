// PATCH /api/profile (WS7): update the signed-in player's handle and / or rating region.
import { z } from 'zod';
import { getCurrentUser } from '@/server/auth';
import { ApiFailure, handle, json, parseBody } from '@/server/http';
import { updateProfile } from '@/server/profile';

export const dynamic = 'force-dynamic';

const Body = z
  .object({
    handle: z.string().max(64).optional(),
    region: z.string().max(8).nullable().optional(),
  })
  .strict();

export async function PATCH(request: Request): Promise<Response> {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) throw new ApiFailure('unauthorized', 'Sign in to edit your profile.');
    const body = await parseBody(request, Body);
    return json(await updateProfile(user.id, body));
  });
}
