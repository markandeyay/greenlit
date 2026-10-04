import type { Metadata } from 'next';
import { APP_NAME } from '@/config/brand';
import { MODES, RELEASE_ORDER } from '@/config/modes';
import { Breadcrumb } from '@/components/chrome/Breadcrumb';
import { SceneHeading } from '@/components/chrome/SceneHeading';
import { ReleaseOrderGame } from '@/components/modes/release-order';

const MODE = MODES.find((m) => m.id === 'release_order')!;

export const metadata: Metadata = {
  title: MODE.name,
  description: `${MODE.pitch} A daily ${APP_NAME} mode with ${RELEASE_ORDER.maxAttempts} takes.`,
};

export default function ReleaseOrderPage() {
  return (
    <main className="l-page gl-page">
      <Breadcrumb items={[{ label: APP_NAME, href: '/' }, { label: 'Modes', href: '/modes' }, { label: MODE.name }]} />
      <div className="mt-10">
        <SceneHeading n={3} as="h1" size="lg" slug="INT. THE EDIT BAY - NIGHT" title={MODE.accentTitle} meta="Put the reels in release order" />
      </div>
      <div className="mt-10">
        <ReleaseOrderGame />
      </div>
    </main>
  );
}
