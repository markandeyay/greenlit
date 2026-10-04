'use client';
import { Poster } from '@/components/game/Poster';
import { Tag } from '@/components/ui/Tag';
import { cx } from '@/components/ui/cx';
import { formatBoxOffice, speakBoxOffice } from '@/lib/format';
import type { OwCard, OwSide } from '@/server/modes/opening-weekend/types';

export interface CardReveal {
  gross: number;
  higher: boolean;
  picked: boolean;
  /** True when the player's pick was right (same for both cards of a pair). */
  correct: boolean;
}

/**
 * One poster in the pair. Before the choice it is a big button; after, it shows its gross with
 * HIGHER / LOWER in words and a check or cross on the player's pick (color is never the only signal).
 */
export function FilmCard({
  film,
  side,
  onPick,
  disabled,
  reveal,
  leaving,
  entering,
}: {
  film: OwCard;
  side: OwSide;
  onPick: (side: OwSide) => void;
  disabled: boolean;
  reveal: CardReveal | null;
  leaving: boolean;
  entering: boolean;
}) {
  const key = side === 'left' ? '1' : '2';
  const arrow = side === 'left' ? '←' : '→';
  const label = reveal
    ? `${film.title} (${film.year}) grossed ${speakBoxOffice(reveal.gross)}, ${reveal.higher ? 'higher' : 'lower'}${
        reveal.picked ? `, your pick, ${reveal.correct ? 'correct' : 'wrong'}` : ''
      }`
    : `Pick ${film.title} (${film.year}) as the bigger worldwide gross. Key ${key} or ${side} arrow.`;
  return (
    <div className={cx('min-w-0', leaving && 'ow-card-out', entering && 'ow-card-in')}>
      <button
        type="button"
        onClick={() => onPick(side)}
        disabled={disabled}
        aria-label={label}
        data-testid={`ow-card-${side}`}
        data-film-id={film.id}
        className={cx(
          'group flex w-full flex-col gap-3 border bg-surface p-2 text-left transition-colors sm:p-3',
          'focus-visible:outline-2 focus-visible:outline-offset-2',
          reveal?.picked && reveal.correct && 'border-green',
          reveal?.picked && !reveal.correct && 'border-red-rec',
          !reveal?.picked && 'border-rule',
          !reveal && !disabled && 'hover:border-ink hover:bg-surface-2',
          disabled && !reveal && 'cursor-wait',
        )}
      >
        <Poster title={film.title} year={film.year} posterPath={film.posterPath} size="lg" className="w-full!" />
        <span className="block min-w-0">
          <span className="ty-display block truncate text-[length:var(--t-d3)] leading-none" title={film.title}>
            {film.title}
          </span>
          <span className="ty-label mt-1 flex items-center justify-between gap-2">
            <span>{film.year}</span>
            {!reveal ? (
              <span aria-hidden="true" className="text-ink-dim">
                {arrow} / {key}
              </span>
            ) : null}
          </span>
        </span>
        <span className="block min-h-[3.25rem]" aria-hidden="true">
          {reveal ? (
            <>
              <span className="flex flex-wrap items-center gap-2">
                <Tag tone={reveal.higher ? 'solid' : 'line'}>{reveal.higher ? 'HIGHER' : 'LOWER'}</Tag>
                {reveal.picked ? (
                  <span className={cx('ty-label', reveal.correct ? 'text-green' : 'text-red-rec')}>
                    {reveal.correct ? '✓' : '✗'} Your pick
                  </span>
                ) : null}
              </span>
              <span className="ty-num mt-1 block text-[length:var(--t-lede)]">{formatBoxOffice(reveal.gross)}</span>
            </>
          ) : (
            <span className="ty-label block text-ink-dim">Grossed more?</span>
          )}
        </span>
      </button>
    </div>
  );
}
