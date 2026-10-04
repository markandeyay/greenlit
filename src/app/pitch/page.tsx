// /pitch (Sections 3, 5, WS8): create a custom challenge for a friend.
import type { Metadata } from 'next';
import { APP_NAME } from '@/config/brand';
import { LAUNCH_DATE, PITCH } from '@/config/game';
import { RULES } from '@/config/rules';
import { Breadcrumb } from '@/components/chrome/Breadcrumb';
import { FilmMicrocopy } from '@/components/chrome/FilmMicrocopy';
import { SlateMeta } from '@/components/chrome/SlateMeta';
import { Accent } from '@/components/ui/Heading';
import { PitchStudio } from '@/components/pitch/PitchStudio';

export const metadata: Metadata = {
  title: 'Pitch a film',
  description: `Pick a film and challenge a friend to guess it on ${APP_NAME}.`,
};

export default function PitchPage() {
  return (
    <main className="l-page gl-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Breadcrumb items={[{ label: APP_NAME, href: '/' }, { label: 'Pitch' }]} />
        <FilmMicrocopy />
      </div>
      <div className="mt-10 max-w-3xl">
        <SlateMeta roll={LAUNCH_DATE.slice(0, 4)} scene={1} take={1} extra={['Pitch meeting']} decorative />
        <h1 className="ty-display mt-3 text-[length:var(--t-d1)]">
          Pitch a <Accent>film</Accent>
        </h1>
        <p className="ty-lede mt-5 text-ink-dim">
          Pick any film, add an optional note, and send the link. Your friend gets {RULES.maxGuesses} takes to
          guess it. The link never gives the film away, and your note stays hidden until take {PITCH.noteUnlockAfter}.
        </p>
      </div>
      <div className="mt-10 max-w-3xl pb-16">
        <PitchStudio />
      </div>
    </main>
  );
}
