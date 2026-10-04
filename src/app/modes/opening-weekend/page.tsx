// Opening Weekend (Section 5, WS9): higher or lower on worldwide gross. The page is a shell; pairs
// come from /api/modes/opening-weekend/* one at a time, with no grosses until each is answered.
import type { Metadata } from 'next';
import { APP_NAME } from '@/config/brand';
import { OPENING_WEEKEND } from '@/config/modes';
import { ModeHeader } from '@/components/modes/ModeHeader';
import { OpeningWeekend } from '@/components/modes/opening-weekend/OpeningWeekend';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Opening Weekend',
  description: `Two posters. Which one grossed more? A ${OPENING_WEEKEND.dailyRunSeconds} second daily run on ${APP_NAME}.`,
};

const s = OPENING_WEEKEND.dailyRunSeconds;

export default function OpeningWeekendPage() {
  return (
    <main className="l-page pt-4 pb-12 sm:pt-6">
      <ModeHeader
        className="mx-auto max-w-xl"
        name="Opening Weekend"
        goal="Tap the film that made more money."
        rules={[
          'Two posters. Tap the one with the bigger worldwide box office (nominal USD).',
          'Right? The winner stays and a new film steps in. One wrong pick ends the run.',
          `Today's run: ${s} seconds on the clock, the same pairs for everyone, one run per day.`,
          'Practice: no clock, endless pairs, your best streak is kept on this device.',
          'Keyboard: 1 or Left arrow for the left poster, 2 or Right arrow for the right.',
        ]}
      />
      <OpeningWeekend />
    </main>
  );
}
