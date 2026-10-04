import type { Metadata } from 'next';
import { APP_NAME } from '@/config/brand';
import { LAUNCH_DATE, LEADERBOARD } from '@/config/game';
import { Breadcrumb } from '@/components/chrome/Breadcrumb';
import { FilmMicrocopy } from '@/components/chrome/FilmMicrocopy';
import { SceneHeading } from '@/components/chrome/SceneHeading';
import { SlateMeta } from '@/components/chrome/SlateMeta';
import { Accent } from '@/components/ui/Heading';
import { LeaderboardView } from '@/components/leaderboard/LeaderboardView';
import { isAuthConfigured } from '@/lib/supabase/config';

export const metadata: Metadata = {
  title: 'Leaderboard',
  description: `Weekly, all time and streak boards for ${APP_NAME}.`,
};

export default function LeaderboardPage() {
  return (
    <main className="l-page gl-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Breadcrumb items={[{ label: APP_NAME, href: '/' }, { label: 'Leaderboard' }]} />
        <FilmMicrocopy />
      </div>

      <div className="mt-10">
        <SlateMeta roll={LAUNCH_DATE.slice(0, 4)} scene={0} take={1} extra={['Credits']} decorative />
        <h1 className="ty-display mt-3 text-[length:var(--t-d1)]">
          The <Accent>credits</Accent>
        </h1>
        <p className="ty-lede mt-5 text-ink-dim">
          Fewest takes wins. Play {LEADERBOARD.weeklyMinDailies} of the last {LEADERBOARD.weeklyWindowDays} daily reels
          to be billed this week.
        </p>
      </div>

      <section className="gl-section mt-16" aria-labelledby="board-title">
        <SceneHeading
          n={1}
          slug="EXT. THE PREMIERE - NIGHT"
          title="Top *billing*"
          meta="Daily reels only. The Vault and pitches never count."
          id="board-title"
        />
        <div className="gl-section__body">
          <LeaderboardView authConfigured={isAuthConfigured()} />
        </div>
      </section>
    </main>
  );
}
