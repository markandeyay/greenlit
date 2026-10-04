// Opening Weekend (Section 5, WS9): higher or lower on worldwide gross. The page is a shell; pairs
// come from /api/modes/opening-weekend/* one at a time, with no grosses until each is answered.
import type { Metadata } from 'next';
import { APP_NAME } from '@/config/brand';
import { OPENING_WEEKEND } from '@/config/modes';
import { Breadcrumb } from '@/components/chrome/Breadcrumb';
import { SceneHeading } from '@/components/chrome/SceneHeading';
import { Accent } from '@/components/ui/Heading';
import { OpeningWeekend } from '@/components/modes/opening-weekend/OpeningWeekend';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Opening Weekend',
  description: `Two posters. Which one grossed more? A ${OPENING_WEEKEND.dailyRunSeconds} second daily run on ${APP_NAME}.`,
};

export default function OpeningWeekendPage() {
  return (
    <main className="l-page gl-page">
      <Breadcrumb items={[{ label: APP_NAME, href: '/' }, { label: 'Modes', href: '/modes' }, { label: 'Opening Weekend' }]} />
      <div className="mt-10">
        <SceneHeading
          n={3}
          as="h1"
          size="lg"
          slug="INT. THE BOX OFFICE - FRIDAY NIGHT"
          title={
            <>
              Opening <Accent>weekend</Accent>
            </>
          }
          meta="Two posters. Which one grossed more?"
        />
      </div>
      <OpeningWeekend />
    </main>
  );
}
