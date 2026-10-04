// Casting Call (Section 5, WS9): connect today's two actors through shared films. A server shell
// paints the first frame from the request cookies; the optimal chain is only in the state once
// the player's round is finished.
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { APP_NAME } from '@/config/brand';
import { CASTING_CALL } from '@/config/modes';
import { CastingCallGame } from '@/components/modes/casting-call/CastingCallGame';
import { ModeHeader } from '@/components/modes/casting-call/ModeHeader';
import { resolveIdentity } from '@/server/plays';
import { getCastingState } from '@/server/modes/casting-call/engine';
import type { CastingCallState } from '@/server/modes/casting-call/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Casting Call',
  description: `Connect two actors through shared films. A daily ${APP_NAME} mode.`,
};

async function initialState(): Promise<CastingCallState | null> {
  try {
    const h = await headers();
    const request = new Request('http://internal/', { headers: { cookie: h.get('cookie') ?? '' } });
    const identity = await resolveIdentity(request);
    return (await getCastingState(request, identity)).state;
  } catch {
    return null;
  }
}

const RULES = [
  'You get a start actor and a goal actor.',
  'Pick a film the current actor is in, then pick a castmate from that film.',
  `Keep linking until you reach the goal. You can use up to ${CASTING_CALL.maxLinks} films.`,
  'Fewer films is better. Links are final, so choose carefully.',
  'Finish to see the shortest possible chain and share your result. A new pair drops at midnight, New York time.',
];

export default async function CastingCallPage() {
  const state = await initialState();
  return (
    <main className="l-page pt-4 pb-12 sm:pt-8">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
        <ModeHeader
          title="Casting Call"
          goal="Connect the two actors through films they share. Fewer films is better."
          rules={RULES}
        />
        <CastingCallGame initial={state} />
      </div>
    </main>
  );
}
