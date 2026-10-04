'use client';
// Finished round: the verdict, the spoiler-free share artifact, and the optimal chain (only ever
// present in a finished state).
import { useMemo, type ReactNode, type RefObject } from 'react';
import { COPY } from '@/config/brand';
import { ButtonLink } from '@/components/ui/Button';
import { StatusGlyph } from '@/components/ui/StatusGlyph';
import { cx } from '@/components/ui/cx';
import { ShareArtifactPanel } from '@/components/share';
import { plural } from '@/lib/format';
import type { CastingCallState } from '@/server/modes/casting-call/types';
import { CastingBoard } from './CastingBoard';
import { castingShareArtifact } from './shareText';

export function CastingResult({
  state,
  headingRef,
  children,
}: {
  state: CastingCallState;
  headingRef?: RefObject<HTMLHeadingElement | null>;
  /** The player's own chain, shown under the share card. */
  children?: ReactNode;
}) {
  const result = state.result!;
  const won = state.status === 'won';
  const films = state.chain.length;
  const optimal = result.optimalFilms;
  const perfect = won && films === optimal;

  const artifact = useMemo(
    () => castingShareArtifact({ date: state.date, status: won ? 'won' : 'lost', films, optimal }),
    [state.date, won, films, optimal],
  );

  const verdict = won
    ? perfect
      ? 'A perfect chain. You matched the optimal path.'
      : `You connected them in ${plural(films, 'film')}.`
    : films >= state.maxLinks
      ? `Out of films after ${plural(films, 'film')}.`
      : 'You walked away from this one.';

  return (
    <section aria-labelledby="cc-result" className="flex flex-col gap-5" data-testid="cc-result" data-status={state.status}>
      <div
        className={cx('rounded-[var(--radius-lg)] border border-rule p-4 sm:p-5', won ? 'gl-status' : 'bg-surface')}
        data-verdict={won ? 'match' : undefined}
      >
        <p data-testid="cc-stamp" className="ty-display anim-stamp inline-block origin-left py-1 text-[clamp(30px,8vw,48px)] leading-none">
          {won ? (
            <span className="inline-flex items-center gap-3">
              <StatusGlyph verdict="match" /> {COPY.winStamp}
            </span>
          ) : (
            COPY.lossStamp
          )}
        </p>
        <h2 id="cc-result" ref={headingRef} tabIndex={-1} className="mt-3 text-lg leading-snug font-semibold outline-none focus-visible:shadow-none! focus-visible:outline-none!">
          {verdict}
        </h2>
        <p className="mt-1 text-sm font-semibold" data-testid="cc-optimal">
          {won ? `Your chain: ${plural(films, 'film')} · ` : ''}Optimal: {plural(optimal, 'film')}
        </p>
      </div>

      <div data-testid="cc-share-preview" data-share-text={artifact.text} className="max-w-full min-w-0 overflow-x-auto">
        <ShareArtifactPanel artifact={artifact} heading="Share your chain" />
      </div>

      {children}

      {perfect ? null : (
        <section aria-label="Optimal chain" className="rounded-[var(--radius-lg)] border border-rule bg-surface p-3 sm:p-4">
          <h3 className="px-2 pb-2 text-sm font-semibold">Optimal chain · {plural(optimal, 'film')}</h3>
          <CastingBoard
            label={`An optimal chain from ${state.start.name} to ${state.end.name}`}
            start={state.start}
            end={state.end}
            chain={result.optimalPath}
            showWanted={false}
          />
        </section>
      )}

      <nav aria-label="What next" className="grid grid-cols-2 gap-3">
        <ButtonLink href="/" variant="outline">
          Today&apos;s reel
        </ButtonLink>
        <ButtonLink href="/modes" variant="ghost">
          More modes
        </ButtonLink>
      </nav>
      <p className="text-center text-sm text-ink-dim">A new pair drops at midnight, New York time.</p>
    </section>
  );
}
