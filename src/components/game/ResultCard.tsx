'use client';

import { useEffect, useId, useState, type Ref } from 'react';
import { COPY } from '@/config/brand';
import { RULES } from '@/config/rules';
import { ShareSheet } from '@/components/share';
import { ButtonLink } from '@/components/ui/Button';
import { Tag } from '@/components/ui/Tag';
import { cx } from '@/components/ui/cx';
import { gameApi } from '@/lib/game/api';
import { beatPercent, bucketFor, withSelf } from '@/lib/game/stats';
import { pad2, percent, plural } from '@/lib/format';
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
}

/** Headline under the stamp. */
export function resultHeadline(status: 'won' | 'lost', takes: number, maxGuesses: number = RULES.maxGuesses): string {
  if (status === 'won') return takes === 1 ? 'In one take. Unheard of.' : `Got the green light in ${plural(takes, 'take')}.`;
  if (takes >= maxGuesses) return `Out of takes after ${maxGuesses}. The reel is shelved.`;
  return takes === 0 ? 'Walked away before the first take.' : `Walked away after ${plural(takes, 'take')}.`;
}

/**
 * The end of the round (Sections 4.1, 7.3): GREENLIT rubber stamp or SENT TO TURNAROUND with a
 * projector flicker, the reveal (poster, title, year, director, tagline, trailer), the global
 * take distribution for the daily, and the share sheet ("Post your take" is the primary action).
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
}: ResultCardProps) {
  const headingId = useId();
  const takes = feedback.length;
  const won = status === 'won';
  const stamp = won ? COPY.winStamp : COPY.lossStamp;

  return (
    <section
      aria-labelledby={headingId}
      className={cx('relative overflow-hidden border-[1.5px] border-ink bg-surface', live && 'anim-rise')}
    >
      <div className="flex items-center justify-between gap-3 border-b border-rule px-4 py-2 font-mono text-[11px] font-bold tracking-[0.12em] text-ink-dim uppercase sm:px-5">
        <span className="truncate">INT. THE SCREENING ROOM - NIGHT</span>
        <span className="flex-none tabular-nums">
          {reelNumber ? `${COPY.reelLabel(reelNumber)} · ` : ''}Tk {pad2(takes)}
        </span>
      </div>

      <div className="px-4 pt-6 pb-5 sm:px-6">
        <div className={cx('flex flex-col items-start gap-5', !won && live && 'gm-flicker')}>
          <p
            aria-hidden="true"
            className={cx(
              'gm-stamp my-5 ml-2 text-[clamp(28px,7vw,54px)]',
              won ? 'gm-stamp--win' : 'gm-stamp--loss',
              live && 'anim-stamp',
            )}
          >
            {stamp}
          </p>
          <div className="min-w-0">
            <h2 ref={headingRef} id={headingId} tabIndex={-1} className="ty-display text-[clamp(22px,4vw,32px)] leading-none outline-none">
              <span className="sr-only">{stamp}. </span>
              {resultHeadline(status, takes)}
            </h2>
            {hintsUsed > 0 ? (
              <p className="mt-2 font-mono text-[12px] text-ink-dim">
                <span aria-hidden="true">📝 </span>
                {plural(hintsUsed, 'script note')} used
              </p>
            ) : null}
          </div>
        </div>

        {reveal ? <RevealBlock reveal={reveal} won={won} /> : null}

        {kind === 'daily' && reelNumber ? (
          <DailyStats reelNumber={reelNumber} status={status} takes={takes} loadStats={loadStats} animate={live} />
        ) : null}

        <div className="mt-6 border-t border-rule pt-5">
          <p className="ty-label mb-3 text-ink">Post your take</p>
          <ShareSheet kind={kind} ref={gameRef} reelNumber={reelNumber} feedback={feedback} status={status} hintsUsed={hintsUsed} />
        </div>

        {kind === 'vault' ? (
          <p className="mt-4 font-mono text-[12px] text-ink-dim">Vault reels are for the love of it: no leaderboard credit.</p>
        ) : null}

        <nav aria-label="What next" className="mt-5 flex flex-wrap gap-3">
          {kind !== 'daily' ? (
            <ButtonLink href="/" variant="outline" size="sm">
              Today&apos;s reel
            </ButtonLink>
          ) : null}
          <ButtonLink href="/vault" variant="outline" size="sm">
            Open the Vault
          </ButtonLink>
          <ButtonLink href="/pitch" variant="ghost" size="sm">
            {kind === 'pitch' ? 'Pitch one back' : COPY.pitchCta}
          </ButtonLink>
        </nav>
      </div>
    </section>
  );
}

function RevealBlock({ reveal, won }: { reveal: Reveal; won: boolean }) {
  return (
    <div className="mt-6 grid gap-5 sm:grid-cols-[auto_1fr]">
      <div className="flex justify-center sm:block">
        <Poster
          title={reveal.title}
          year={reveal.year}
          posterPath={reveal.posterPath}
          size="lg"
          alt={`Poster for ${reveal.title}`}
          className="shadow-[0_18px_50px_rgba(0,0,0,0.6)]"
        />
      </div>
      <div className="min-w-0">
        <p className="ty-micro text-ink-dim">{won ? 'You found' : 'The film was'}</p>
        <p className="ty-display mt-2 text-[clamp(34px,6vw,56px)] leading-[0.9]">{reveal.title}</p>
        <p className="mt-3 font-mono text-[14px] font-bold">
          <span className="tabular-nums">{reveal.year}</span>
          <span className="text-ink-dim"> · Directed by </span>
          {reveal.director}
        </p>
        {reveal.tagline ? (
          <p className="mt-4 max-w-[46ch] font-serif text-[clamp(19px,2.4vw,24px)] leading-snug text-ink italic">
            &ldquo;{reveal.tagline}&rdquo;
          </p>
        ) : null}
        {reveal.trailerYoutube ? (
          <div className="mt-5 max-w-[560px]">
            <TrailerEmbed youtubeKey={reveal.trailerYoutube} title={reveal.title} />
          </div>
        ) : null}
      </div>
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
    <div className="mt-6 border-t border-rule pt-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="ty-display text-[clamp(20px,3vw,26px)] leading-none" aria-live="polite">
          {line}
        </p>
        {state === 'ready' && others > 0 ? (
          <Tag tone="dim">{plural(view.plays, 'player')}</Tag>
        ) : null}
      </div>
      {state === 'ready' && others > 0 ? (
        <div className="mt-4">
          <DistributionChart distribution={view.distribution} plays={view.plays} you={bucket} animate={animate} />
        </div>
      ) : null}
    </div>
  );
}
