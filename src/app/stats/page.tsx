import type { Metadata } from 'next';
import { APP_NAME } from '@/config/brand';
import { LAUNCH_DATE } from '@/config/game';
import { Breadcrumb } from '@/components/chrome/Breadcrumb';
import { FilmMicrocopy } from '@/components/chrome/FilmMicrocopy';
import { SlateMeta } from '@/components/chrome/SlateMeta';
import { Accent } from '@/components/ui/Heading';
import { StatsView } from '@/components/stats/StatsView';

export const metadata: Metadata = {
  title: 'Stats',
  description: `Your ${APP_NAME} takes, streaks and distribution.`,
};

export default function StatsPage() {
  return (
    <main className="l-page gl-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Breadcrumb items={[{ label: APP_NAME, href: '/' }, { label: 'Stats' }]} />
        <FilmMicrocopy />
      </div>

      <div className="mt-10">
        <SlateMeta roll={LAUNCH_DATE.slice(0, 4)} scene={0} take={1} extra={['Dailies']} decorative />
        <h1 className="ty-display mt-3 text-[length:var(--t-d1)]">
          Your <Accent>dailies</Accent>
        </h1>
        <p className="ty-lede mt-5 text-ink-dim">Every reel you have wrapped: takes, streaks and how close you cut it.</p>
      </div>

      <div className="mt-10">
        <StatsView />
      </div>
    </main>
  );
}
