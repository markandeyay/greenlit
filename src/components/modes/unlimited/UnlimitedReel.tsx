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
import { HowToPlay, ModeHeader } from '../ModeHeader';
import { BandPicker } from './BandPicker';
import { dealReel, emptyPlay, readStoredReel, resumeReel, writeStoredReel } from './reel-client';

const GOAL = `Endless practice. Name a random film in ${RULES.maxGuesses} takes.`;
const RULES_LIST = [
  'Pick a difficulty, then roll a random film from it.',
  'Search any film for a take. Each clue shows ✓ match, ≈ close or a miss, and number clues say which way to go (LATER or EARLIER, BIGGER or SMALLER).',
  `You have ${RULES.maxGuesses} takes. Script Notes hints unlock as you go.`,
  'No streaks and no leaderboard here. Finish a reel and roll the next one.',
];

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
      <section aria-label="Dailies Reel" className="mx-auto flex max-w-xl flex-col gap-5">
        <ModeHeader name="Dailies Reel" goal={GOAL} rules={RULES_LIST} />
        <BandPicker legend="Pick a difficulty" value={band} onChange={setBand} disabled={dealing} />
        <Button variant="slate" size="lg" block onClick={() => void deal(null)} disabled={dealing} aria-busy={dealing || undefined}>
          {dealing ? 'Dealing...' : 'Roll the reel'}
        </Button>
        {tally ? <p className="m-0 text-center font-mono text-[12px] text-ink-dim">{tally}</p> : null}
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
        <div className="mt-2 flex items-center justify-end gap-1" data-testid="reel-bar">
          {dealing ? <Spinner label="Dealing the next reel" /> : null}
          <Button variant="ghost" size="sm" onClick={() => setPhase({ name: 'pick' })} disabled={dealing}>
            Change difficulty
          </Button>
          <HowToPlay title="How to play Dailies Reel" rules={RULES_LIST} />
        </div>
      }
    />
  );
}
