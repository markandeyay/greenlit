// Logline mode (Section 5, WS9): a server shell that renders the player's round (earned tiers
// only) as the first frame, with the game as a client island. The film's title and id reach the
// client only once the round is over (Section 10).
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { APP_NAME } from '@/config/brand';
import { LOGLINE } from '@/config/modes';
import { LoglineGame } from '@/components/modes/logline/LoglineGame';
import { ModeHeader } from '@/components/modes/logline/ModeHeader';
import type { LoglineStateResponse } from '@/components/modes/logline/types';
import { resolveIdentity } from '@/server/plays';
import { getLoglineState, readStateToken } from '@/server/modes/logline';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Logline',
  description: `Name the film from a one line synopsis that gets sharper with every take. A daily ${APP_NAME} mode.`,
};

async function initialState(): Promise<LoglineStateResponse | null> {
  try {
    const h = await headers();
    const request = new Request('http://internal/', {
      headers: { cookie: h.get('cookie') ?? '', 'accept-language': h.get('accept-language') ?? '' },
    });
    const identity = await resolveIdentity(request);
    // Read only: a first-time visitor gets a fresh round; cookies are set on the first take.
    const { state } = await getLoglineState(identity, readStateToken(request));
    return state;
  } catch {
    return null; // the client fetches it instead
  }
}

const RULES = [
  'Read the logline: a one line summary of a film.',
  'Type a title and pick it from the list to make a take.',
  `Each miss unlocks a sharper draft of the logline. There are ${LOGLINE.tiers} drafts in all.`,
  `You get ${LOGLINE.maxTakes} takes. Name the film in as few as you can.`,
  'Finish to see the film and share your result. A new logline drops at midnight, New York time.',
];

export default async function LoglinePage() {
  const initial = await initialState();
  return (
    <main className="l-page pt-4 pb-12 sm:pt-8">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
        <ModeHeader title="Logline" goal="Name the film from its logline. Every miss makes it sharper." rules={RULES} />
        <LoglineGame initial={initial} />
      </div>
    </main>
  );
}
