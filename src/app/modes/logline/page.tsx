// Logline mode (Section 5, WS9): a server shell that renders the player's round (earned tiers
// only) as the first frame, with the game as a client island. The film's title and id reach the
// client only once the round is over (Section 10).
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { APP_NAME } from '@/config/brand';
import { LOGLINE } from '@/config/modes';
import { Breadcrumb } from '@/components/chrome/Breadcrumb';
import { SceneHeading } from '@/components/chrome/SceneHeading';
import { Accent } from '@/components/ui/Heading';
import { LoglineGame } from '@/components/modes/logline/LoglineGame';
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

export default async function LoglinePage() {
  const initial = await initialState();
  return (
    <main className="l-page gl-page">
      <Breadcrumb items={[{ label: APP_NAME, href: '/' }, { label: 'Modes', href: '/modes' }, { label: 'Logline' }]} />
      <div className="mt-8">
        <SceneHeading
          n={1}
          as="h1"
          size="lg"
          slug="INT. THE WRITERS ROOM - NIGHT"
          title={
            <>
              The <Accent>logline</Accent>
            </>
          }
          meta={`One film a day. ${LOGLINE.maxTakes} takes. Every miss buys a sharper draft`}
        />
      </div>
      <LoglineGame initial={initial} />
    </main>
  );
}
