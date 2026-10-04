'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { UNLIMITED, type UnlimitedBand } from '@/config/modes';
import { RULES } from '@/config/rules';
import { GameBoard } from '@/components/game/GameBoard';
import { Button } from '@/components/ui/Button';
import { Accent } from '@/components/ui/Heading';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { friendlyError } from '@/lib/game/api';
import { plural } from '@/lib/format';
import { readLocalStats, summarize } from '@/lib/local-stats';
import type { PlayStateResponse, RegionCode } from '@/lib/types';
import { BandPicker } from './BandPicker';
import { dealReel, emptyPlay, readStoredReel, resumeReel, writeStoredReel } from './reel-client';

type Phase =
  | { name: 'boot' }
  | { name: 'pick' }
  | { name: 'playing'; ref: string; band: UnlimitedBand; initialPlay: PlayStateResponse | null };

const KICKER = 'Dailies reel';

function tallyLine(): string | null {
  const s = summarize(readLocalStats(), 'unlimited');
  if (s.played === 0) return null;
  return `On this device: ${plural(s.played, 'reel')} played, ${s.wins} greenlit.`;
}

/**
 * The Dailies Reel (Unlimited, Section 5): pick a difficulty band, get a random film as an opaque
 * ref, and play it with the classic engine (kind 'unlimited'). No streaks, no leaderboard. The
 * current reel is remembered on this device so a reload resumes it; "Next reel" deals another.
 */
export function UnlimitedReel({ playerRegion }: { playerRegion?: RegionCode }) {
  const { toast } = useToast();
  const [phase, setPhase] = useState<Phase>({ name: 'boot' });
  const [band, setBand] = useState<UnlimitedBand>(UNLIMITED.defaultBand);
  const [dealing, setDealing] = useState(false);
  const [tally, setTally] = useState<string | null>(null);
  const dealingRef = useRef(false);

  // Resume the reel stored on this device, if it still resolves.
  useEffect(() => {
    let live = true;
    // Storage is read after mount (it does not exist on the server), then the stored reel is
    // checked against the server before the board paints.
    const boot = async () => {
      const stored = readStoredReel();
      const tallyNow = tallyLine();
      let next: Phase = { name: 'pick' };
      if (stored) {
        try {
          const play = await resumeReel(stored.ref);
          if (play) next = { name: 'playing', ref: stored.ref, band: stored.band, initialPlay: play };
          else writeStoredReel(null);
        } catch {
          // Network trouble: let the board try again (it shows its own retry state).
          next = { name: 'playing', ref: stored.ref, band: stored.band, initialPlay: null };
        }
      }
      if (!live) return;
      setTally(tallyNow);
      if (stored) setBand(stored.band);
      setPhase(next);
    };
    void boot();
    return () => {
      live = false;
    };
  }, []);

  const deal = useCallback(
    async (after: string | null) => {
      if (dealingRef.current) return;
      dealingRef.current = true;
      setDealing(true);
      try {
        const ref = await dealReel(band, after);
        writeStoredReel({ ref, band });
        setTally(tallyLine());
        setPhase({ name: 'playing', ref, band, initialPlay: emptyPlay(ref) });
        try {
          const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
          window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
        } catch {
          /* no scrolling in this environment */
        }
      } catch (e) {
        toast(friendlyError(e));
      } finally {
        dealingRef.current = false;
        setDealing(false);
      }
    },
    [band, toast],
  );

  if (phase.name === 'boot') {
    return (
      <div className="mt-6 flex min-h-[240px] items-center justify-center border border-dashed border-rule" data-testid="reel-boot">
        <Spinner label="Threading the reel" showLabel />
      </div>
    );
  }

  if (phase.name === 'pick') {
    return (
      <section aria-labelledby="unlimited-title" className="border border-rule bg-surface px-4 py-6 sm:px-6">
        <p className="ty-micro text-ink-dim">{KICKER}</p>
        <h1 id="unlimited-title" className="ty-display mt-2 text-[clamp(34px,7vw,64px)] leading-[0.9]">
          Dailies <Accent>reel</Accent>
        </h1>
        <p className="mt-4 max-w-[52ch] text-[15px] text-ink-dim">
          Endless practice with the classic rules: {RULES.maxGuesses} takes to name a random film. Pick how deep
          into the archive we dig. No streaks, no leaderboard, just reps.
        </p>
        <BandPicker className="mt-6" legend="Difficulty" value={band} onChange={setBand} disabled={dealing} />
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button variant="solid" onClick={() => void deal(null)} disabled={dealing} aria-busy={dealing || undefined}>
            {dealing ? 'Dealing...' : 'Roll the reel'}
          </Button>
          {tally ? <p className="font-mono text-[12px] text-ink-dim">{tally}</p> : null}
        </div>
      </section>
    );
  }

  const ref = phase.ref;
  return (
    <GameBoard
      key={ref}
      kind="unlimited"
      gameRef={ref}
      reelNumber={null}
      date={null}
      theme={UNLIMITED.bands[phase.band].label}
      kicker={KICKER}
      title={
        <>
          Dailies <Accent>reel</Accent>
        </>
      }
      playerRegion={playerRegion}
      initialPlay={phase.initialPlay}
      onNextReel={() => void deal(ref)}
      intro={
        <div className="mt-4 grid gap-3">
          <BandPicker legend="Difficulty for the next reel" value={band} onChange={setBand} disabled={dealing} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            {tally ? <p className="font-mono text-[12px] text-ink-dim">{tally}</p> : <span />}
            {dealing ? <Spinner label="Dealing the next reel" showLabel /> : null}
          </div>
        </div>
      }
    />
  );
}
