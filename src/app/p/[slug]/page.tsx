// Play a custom challenge (kind 'pitch'). Only the pitch's existence is checked here; no pitch
// field is rendered (the creator's note is a Script Note served by /api/hint).
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { APP_NAME } from '@/config/brand';
import { PITCH } from '@/config/game';
import { RULES } from '@/config/rules';
import { Accent } from '@/components/ui/Heading';
import { GameBoard } from '@/components/game/GameBoard';
import { initialPlayFor } from '@/server/engine/initial-play';
import { playerRegion } from '@/lib/game/server-region';
import { getRepo } from '@/server/db';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'A friend pitched you a film',
  description: `Can you name the film in ${APP_NAME}?`,
  robots: { index: false },
};

export default async function PitchPlayPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!slug || slug.length > 512 || !/^[A-Za-z0-9_-]+$/.test(slug)) notFound();
  let exists = false;
  try {
    exists = (await getRepo().getPitch(slug)) !== null;
  } catch {
    exists = false;
  }
  if (!exists) notFound();
  const [region, initialPlay] = await Promise.all([playerRegion(), initialPlayFor('pitch', slug)]);
  return (
    <main className="l-page pt-3 pb-16 sm:pt-6">
      <GameBoard
        kind="pitch"
        initialPlay={initialPlay}
        gameRef={slug}
        reelNumber={null}
        date={null}
        theme="A friend's pick"
        kicker="A friend pitched you a film"
        title={
          <>
            The <Accent>pitch</Accent>
          </>
        }
        playerRegion={region}
        intro={
          <p className="mt-2 text-[15px] text-ink-dim">
            A friend picked a film. Name it in {RULES.maxGuesses} takes. Their note unlocks after take {PITCH.noteUnlockAfter}.
          </p>
        }
      />
    </main>
  );
}
