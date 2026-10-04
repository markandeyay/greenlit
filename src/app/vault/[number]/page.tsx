// Play a past daily from the Vault (kind 'vault'). Today and future reels are not in the Vault.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { COPY } from '@/config/brand';
import { GameBoard } from '@/components/game/GameBoard';
import { initialPlayFor } from '@/server/engine/initial-play';
import { playerRegion } from '@/lib/game/server-region';
import { getVaultPuzzle } from '@/server/puzzles';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ number: string }> };

async function load(raw: string) {
  if (!/^\d{1,6}$/.test(raw)) return null;
  return getVaultPuzzle(Number(raw));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { number } = await params;
  const p = await load(number);
  return { title: p ? `${COPY.reelLabel(p.number)} · The Vault` : 'The Vault' };
}

export default async function VaultReelPage({ params }: Params) {
  const { number } = await params;
  const puzzle = await load(number);
  if (!puzzle) notFound();
  const [region, initialPlay] = await Promise.all([playerRegion(), initialPlayFor('vault', String(puzzle.number))]);
  return (
    <main className="l-page pt-3 pb-16 sm:pt-6">
      <GameBoard
        kind="vault"
        initialPlay={initialPlay}
        gameRef={String(puzzle.number)}
        reelNumber={puzzle.number}
        date={puzzle.date}
        theme={puzzle.theme}
        kicker="From the Vault · No leaderboard credit"
        title={COPY.reelLabel(puzzle.number)}
        playerRegion={region}
      />
    </main>
  );
}
