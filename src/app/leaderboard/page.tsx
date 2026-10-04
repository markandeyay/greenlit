import type { Metadata } from 'next';
import { APP_NAME } from '@/config/brand';
import { LEADERBOARD } from '@/config/game';
import { PageHeader } from '@/components/chrome/PageHeader';
import { LeaderboardView } from '@/components/leaderboard/LeaderboardView';
import { isAuthConfigured } from '@/lib/supabase/config';

export const metadata: Metadata = {
  title: 'Leaderboard',
  description: `Weekly, all time and streak boards for ${APP_NAME}.`,
};

export default function LeaderboardPage() {
  return (
    <main className="l-page gl-page max-w-[880px]!">
      <PageHeader
        title="Leaderboard"
        lede={`Fewest takes wins. Play ${LEADERBOARD.weeklyMinDailies} of the last ${LEADERBOARD.weeklyWindowDays} daily reels to be billed this week. Vault plays and pitches never count.`}
      />
      <div className="mt-6">
        <LeaderboardView authConfigured={isAuthConfigured()} />
      </div>
    </main>
  );
}
