// Casting Call (Section 5, WS9): connect today's two actors through shared films. A server shell
// paints the first frame from the request cookies; the optimal chain is only in the state once
// the player's round is finished.
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { APP_NAME } from '@/config/brand';
import { Breadcrumb } from '@/components/chrome/Breadcrumb';
import { SceneHeading } from '@/components/chrome/SceneHeading';
import { Accent } from '@/components/ui/Heading';
import { CastingCallGame } from '@/components/modes/casting-call/CastingCallGame';
import { resolveIdentity } from '@/server/plays';
import { getCastingState } from '@/server/modes/casting-call/engine';
import { formatLongDate } from '@/lib/format';
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

export default async function CastingCallPage() {
  const state = await initialState();
  return (
    <main className="l-page gl-page">
      <Breadcrumb items={[{ label: APP_NAME, href: '/' }, { label: 'Modes', href: '/modes' }, { label: 'Casting Call' }]} />
      <div className="mt-8">
        <SceneHeading
          n={1}
          as="h1"
          size="lg"
          slug="INT. THE CASTING OFFICE - DAY"
          title={
            <>
              Casting <Accent>call</Accent>
            </>
          }
          meta={
            state
              ? `${state.start.name} to ${state.end.name} · ${formatLongDate(state.date)}`
              : 'Connect two actors through shared films'
          }
        />
      </div>
      <div className="mt-10">
        <CastingCallGame initial={state} />
      </div>
    </main>
  );
}
