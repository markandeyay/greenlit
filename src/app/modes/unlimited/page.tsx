// Unlimited / Dailies Reel (Section 5, WS9). The page renders no film data at all: the reel is
// dealt client-side as an opaque ref from POST /api/modes/unlimited/new and played with the
// classic engine (kind 'unlimited').
import type { Metadata } from 'next';
import { APP_NAME } from '@/config/brand';
import { RULES } from '@/config/rules';
import { Breadcrumb } from '@/components/chrome/Breadcrumb';
import { UnlimitedReel } from '@/components/modes/unlimited/UnlimitedReel';
import { playerRegion } from '@/lib/game/server-region';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Dailies Reel',
  description: `Endless ${APP_NAME} practice. Pick a difficulty and name the film in ${RULES.maxGuesses} takes.`,
};

export default async function UnlimitedPage() {
  const region = await playerRegion();
  return (
    <main className="l-page pt-5 pb-16 sm:pt-8">
      <div className="mb-4">
        <Breadcrumb items={[{ label: APP_NAME, href: '/' }, { label: 'Modes', href: '/modes' }, { label: 'Dailies Reel' }]} />
      </div>
      <UnlimitedReel playerRegion={region} />
    </main>
  );
}
