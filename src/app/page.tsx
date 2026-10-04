// Today (Section 3 "/"): a server shell with the game as a client island. Only public puzzle
// fields (number, date, theme) are read here; the answer never leaves the server.
import type { Metadata } from 'next';
import { APP_NAME, COPY } from '@/config/brand';
import { Breadcrumb } from '@/components/chrome/Breadcrumb';
import { FilmMicrocopy } from '@/components/chrome/FilmMicrocopy';
import { reelCode } from '@/components/chrome/timecode';
import { ButtonLink } from '@/components/ui/Button';
import { Accent } from '@/components/ui/Heading';
import { GameBoard } from '@/components/game/GameBoard';
import { playerRegion } from '@/lib/game/server-region';
import { getToday } from '@/server/puzzles';
import type { TodayResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { absolute: `${APP_NAME} · Today's reel` },
};

export default async function TodayPage() {
  let today: TodayResponse | null = null;
  try {
    today = await getToday();
  } catch {
    today = null;
  }

  if (!today) {
    return (
      <main className="l-page gl-page">
        <h1 className="ty-display text-[length:var(--t-d1)]">
          No reel <Accent>tonight</Accent>
        </h1>
        <p className="ty-lede mt-5 text-ink-dim">
          The projectionist is still threading today&apos;s film. Check back soon, or dig through the Vault.
        </p>
        <div className="mt-8">
          <ButtonLink href="/vault" variant="slate" size="lg">
            Open the Vault
          </ButtonLink>
        </div>
      </main>
    );
  }

  const region = await playerRegion();
  return (
    <main className="l-page pt-5 pb-16 sm:pt-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Breadcrumb
          decorative
          items={[{ label: APP_NAME }, { label: today.date.slice(0, 4) }, { label: reelCode(today.number) }]}
        />
        <FilmMicrocopy />
      </div>
      <GameBoard
        kind="daily"
        gameRef={String(today.number)}
        reelNumber={today.number}
        date={today.date}
        theme={today.theme}
        kicker="Today's reel · Name the film"
        title={COPY.reelLabel(today.number)}
        playerRegion={region}
      />
    </main>
  );
}
