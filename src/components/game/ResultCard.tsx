'use client';

import Link from 'next/link';
import { useEffect, useId, useState, type Ref } from 'react';
import { COPY } from '@/config/brand';
import { RULES } from '@/config/rules';
import { ShareSheet } from '@/components/share';
import { Button } from '@/components/ui/Button';
import { cx } from '@/components/ui/cx';
import { gameApi } from '@/lib/game/api';
import { beatPercent, bucketFor, withSelf } from '@/lib/game/stats';
import { percent, plural } from '@/lib/format';
import type { DailyStatsResponse, GuessFeedback, ClassicKind, Reveal } from '@/lib/types';
import { DistributionChart } from './DistributionChart';
import { Poster } from './Poster';
import { TrailerEmbed } from './TrailerEmbed';

export interface ResultCardProps {
  kind: ClassicKind;
  gameRef: string;
  reelNumber: number | null;
  status: 'won' | 'lost';
  feedback: GuessFeedback[];
  hintsUsed: number;
  reveal: Reveal | null;
  /** The round ended during this page view: play the stamp and flicker. */
  live?: boolean;
  headingRef?: Ref<HTMLHeadingElement>;
  loadStats?: (n: number) => Promise<DailyStatsResponse>;
  /** Unlimited (Dailies Reel): deal the next reel. */
  onNextReel?: () => void;
}

/** Headline under the stamp. */
export function resultHeadline(status: 'won' | 'lost', takes: number, maxGuesses: number = RULES.maxGuesses): string {
  if (status === 'won') return takes === 1 ? 'In one take. Unheard of.' : `Got the green light in ${plural(takes, 'take')}.`;
  if (takes >= maxGuesses) return `Out of takes after ${maxGuesses}. The reel is shelved.`;
  return takes === 0 ? 'Walked away before the first take.' : `Walked away after ${plural(takes, 'take')}.`;
}

/**
 * The end of the round (Sections 4.1, 7.3), as one clean card: the GREENLIT rubber stamp (or SENT
 * TO TURNAROUND with a projector flicker), the reveal (poster, title, year, director), "You beat N%
 * of players", then the share artifact. The trailer waits behind a small button; where to go next
 * is a row of quiet links.
 */
export function ResultCard({
  kind,
  gameRef,
  reelNumber,
  status,
  feedback,
  hintsUsed,
  reveal,
  live = false,
  headingRef,
  loadStats = gameApi.dailyStats,
  onNextReel,
}: ResultCardProps) {
  const headingId = useId();
  const takes = feedback.length;
  const won = status === 'won';
  const stamp = won ? COPY.winStamp : COPY.lossStamp;

  return (
    <section
      aria-labelledby={headingId}
      data-testid="result-card"
      data-status={status}
      className={cx('gm-result', live && 'anim-rise')}
    >
      <div className={cx('flex flex-col items-center text-center', !won && live && 'gm-flicker')}>
        <p
          aria-hidden="true"
          className={cx(
            'gm-stamp text-[clamp(26px,7vw,44px)]',
            won ? 'gm-stamp--win' : 'gm-stamp--loss',
            live && 'anim-stamp',
          )}
        >
          {stamp}
        </p>
        <h2
          ref={headingRef}
          id={headingId}
          tabIndex={-1}
          className="mt-5 text-[clamp(18px,4.4vw,22px)] leading-snug font-semibold outline-none"
        >
          <span className="sr-only">{stamp}. </span>
          {resultHeadline(status, takes)}
        </h2>
        {hintsUsed > 0 ? (
          <p className="mt-1 text-[14px] text-ink-dim">
            <span aria-hidden="true">📝 </span>
            {plural(hintsUsed, 'script note')} used
          </p>
        ) : null}
      </div>

      {reveal ? <RevealBlock reveal={reveal} won={won} /> : null}

      {kind === 'daily' && reelNumber ? (
        <DailyStats reelNumber={reelNumber} status={status} takes={takes} loadStats={loadStats} animate={live} />
      ) : null}

      <div className="mt-6">
        <ShareSheet kind={kind} ref={gameRef} reelNumber={reelNumber} feedback={feedback} status={status} hintsUsed={hintsUsed} />
      </div>

      {kind === 'vault' ? (
        <p className="mt-4 text-center text-[13px] text-ink-dim">Vault reels are for the love of it: no leaderboard credit.</p>
      ) : null}

      {kind === 'unlimited' ? (
        <p className="mt-4 text-center text-[13px] text-ink-dim">Dailies reels are practice: no streaks, no leaderboard.</p>
      ) : null}

      <nav aria-label="What next" className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-rule pt-4">
        {onNextReel ? (
          <Button variant="solid" size="sm" onClick={onNextReel}>
            Next reel
          </Button>
        ) : null}
        {kind !== 'daily' ? (
          <Link href="/" className="gm-quietlink">
            Today&apos;s reel
          </Link>
        ) : null}
        <Link href="/vault" className="gm-quietlink">
          Open the Vault
        </Link>
        <Link href="/pitch" className="gm-quietlink">
          {kind === 'pitch' ? 'Pitch one back' : COPY.pitchCta}
        </Link>
      </nav>
    </section>
  );
}

function RevealBlock({ reveal, won }: { reveal: Reveal; won: boolean }) {
  const [trailer, setTrailer] = useState(false);
  return (
    <div className="mt-6 flex flex-col items-center text-center">
      <Poster
        title={reveal.title}
        year={reveal.year}
        posterPath={reveal.posterPath}
        size="lg"
        alt={`Poster for ${reveal.title}`}
        className="gm-result__poster"
      />
      <p className="mt-4 text-[13px] text-ink-dim">{won ? 'You found' : 'The film was'}</p>
      <p className="ty-display mt-1 text-[clamp(30px,8vw,44px)] leading-[0.95]">{reveal.title}</p>
      <p className="mt-2 text-[15px]">
        <span className="tabular-nums">{reveal.year}</span>
        <span className="text-ink-dim"> · Directed by </span>
        {reveal.director}
      </p>
      {reveal.tagline ? (
        <p className="mt-2 max-w-[40ch] font-serif text-[18px] leading-snug text-ink-dim italic">&ldquo;{reveal.tagline}&rdquo;</p>
      ) : null}
      {reveal.trailerYoutube ? (
        trailer ? (
          <div className="mt-4 w-full max-w-[560px]">
            <TrailerEmbed youtubeKey={reveal.trailerYoutube} title={reveal.title} autoLoad />
          </div>
        ) : (
          <Button variant="outline" size="sm" className="mt-4" onClick={() => setTrailer(true)} aria-label={`Watch trailer: ${reveal.title}`}>
            <span aria-hidden="true">▶ </span>Watch trailer
          </Button>
        )
      ) : null}
    </div>
  );
}

function DailyStats({
  reelNumber,
  status,
  takes,
  loadStats,
  animate,
}: {
  reelNumber: number;
  status: 'won' | 'lost';
  takes: number;
  loadStats: (n: number) => Promise<DailyStatsResponse>;
  animate: boolean;
}) {
  const [stats, setStats] = useState<DailyStatsResponse | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  useEffect(() => {
    let live = true;
    loadStats(reelNumber)
      .then((s) => {
        if (!live) return;
        setStats(s);
        setState('ready');
      })
      .catch(() => {
        if (live) setState('error');
      });
    return () => {
      live = false;
    };
  }, [reelNumber, loadStats]);

  const bucket = bucketFor(status, takes);
  const view = withSelf(stats, bucket);
  const beat = beatPercent(view, bucket);
  const others = view.plays - 1;

  let line: string;
  if (state === 'loading') line = 'Counting the house...';
  else if (state === 'error') line = 'The box office numbers are not in yet. Check back in a minute.';
  else if (others <= 0) line = 'You are the first one on set today. Nobody else has finished this reel yet.';
  else if (beat !== null) line = `You beat ${beat}% of players today.`;
  else line = `${percent(view.wins, view.plays)}% of players greenlit it today. Tomorrow is a new reel.`;

  return (
    <div className="mt-6 rounded-[var(--radius)] bg-surface-2 px-4 py-3 text-center">
      <p className="ty-display text-[clamp(20px,5vw,24px)] leading-tight" aria-live="polite">
        {line}
      </p>
      {state === 'ready' && others > 0 ? (
        <details className="gm-dist mt-2 text-left">
          <summary className="cursor-pointer text-center text-[13px] text-ink-dim">
            How {plural(view.plays, 'player')} did
          </summary>
          <div className="mt-3">
            <DistributionChart distribution={view.distribution} plays={view.plays} you={bucket} animate={animate} />
          </div>
        </details>
      ) : null}
    </div>
  );
}
