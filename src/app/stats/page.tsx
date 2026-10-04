import type { Metadata } from 'next';
import { APP_NAME } from '@/config/brand';
import { PageHeader } from '@/components/chrome/PageHeader';
import { Accent } from '@/components/ui/Heading';
import { StatsView } from '@/components/stats/StatsView';

export const metadata: Metadata = {
  title: 'Stats',
  description: `Your ${APP_NAME} takes, streaks and distribution.`,
};

export default function StatsPage() {
  return (
    <main className="l-page gl-page max-w-[720px]!">
      <PageHeader
        title={
          <>
            Your <Accent>stats</Accent>
          </>
        }
      />
      <div className="mt-6">
        <StatsView />
      </div>
    </main>
  );
}
