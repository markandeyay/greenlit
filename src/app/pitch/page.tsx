// /pitch (Sections 3, 5, WS8): create a custom challenge for a friend.
import type { Metadata } from 'next';
import { APP_NAME } from '@/config/brand';
import { RULES } from '@/config/rules';
import { PageHeader } from '@/components/chrome/PageHeader';
import { Accent } from '@/components/ui/Heading';
import { PitchStudio } from '@/components/pitch/PitchStudio';

export const metadata: Metadata = {
  title: 'Pitch a film',
  description: `Pick a film and challenge a friend to guess it on ${APP_NAME}.`,
};

export default function PitchPage() {
  return (
    <main className="l-page gl-page max-w-[720px]!">
      <PageHeader
        title={
          <>
            Pitch a <Accent>film</Accent>
          </>
        }
        lede={`Pick any film and send the link. Your friend gets ${RULES.maxGuesses} takes to guess it, and the link never gives it away.`}
      />
      <div className="mt-6">
        <PitchStudio />
      </div>
    </main>
  );
}
