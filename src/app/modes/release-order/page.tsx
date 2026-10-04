import type { Metadata } from 'next';
import { APP_NAME } from '@/config/brand';
import { MODES, RELEASE_ORDER } from '@/config/modes';
import { ModeHeader } from '@/components/modes/ModeHeader';
import { ReleaseOrderGame } from '@/components/modes/release-order';

const MODE = MODES.find((m) => m.id === 'release_order')!;

export const metadata: Metadata = {
  title: MODE.name,
  description: `${MODE.pitch} A daily ${APP_NAME} mode with ${RELEASE_ORDER.maxAttempts} takes.`,
};

export default function ReleaseOrderPage() {
  return (
    <main className="l-page pt-4 pb-6 sm:pt-6 sm:pb-12">
      <ModeHeader
        className="mx-auto max-w-xl"
        name={MODE.name}
        goal="Sort five films from oldest to newest."
        rules={[
          `Same ${RELEASE_ORDER.filmsPerSet} films for everyone today. Put them in release order, oldest at the top.`,
          'Drag a film by its handle, or use the up and down arrows.',
          `You get ${RELEASE_ORDER.maxAttempts} takes. After each one, every film shows ✓ right spot, ≈ one spot off, or ✗ wrong spot.`,
          'Release dates stay hidden until the round is over.',
        ]}
      />
      <div className="mt-4">
        <ReleaseOrderGame />
      </div>
    </main>
  );
}
