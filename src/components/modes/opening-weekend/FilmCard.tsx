'use client';
import { Poster } from '@/components/game/Poster';
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
 * One poster in the pair. The whole card is the tap target. After the choice it shows its gross
 * with HIGHER / LOWER in words, and a check or cross on the player's pick (never color alone).
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
  const label = reveal
    ? `${film.title} (${film.year}) grossed ${speakBoxOffice(reveal.gross)}, ${reveal.higher ? 'higher' : 'lower'}${
        reveal.picked ? `, your pick, ${reveal.correct ? 'correct' : 'wrong'}` : ''
      }`
    : `Pick ${film.title} (${film.year}) as the bigger worldwide gross. Key ${key} or ${side} arrow.`;
  const good = reveal?.picked && reveal.correct;
  const bad = reveal?.picked && !reveal.correct;
  return (
    <div className={cx('min-w-0', leaving && 'ow-card-out', entering && 'ow-card-in')}>
      <button
        type="button"
        onClick={() => onPick(side)}
        disabled={disabled}
        aria-label={label}
        data-testid={`ow-card-${side}`}
        data-film-id={film.id}
        data-result={good ? 'correct' : bad ? 'wrong' : undefined}
        className={cx(
          'ow-card group flex w-full touch-manipulation flex-col gap-2 rounded-[6px] border-2 bg-surface p-1.5 text-left transition-[border-color,transform] sm:p-2',
          'focus-visible:outline-2 focus-visible:outline-offset-2',
          good && 'ow-pop border-green',
          bad && 'ow-shake border-red-rec',
          !reveal?.picked && 'border-rule',
          !reveal && !disabled && 'hover:border-ink active:scale-[0.98]',
          disabled && !reveal && 'cursor-wait',
        )}
      >
        <span className="relative block">
          <Poster title={film.title} year={film.year} posterPath={film.posterPath} size="lg" className="w-full!" />
          {reveal ? (
            <span aria-hidden="true" className="absolute inset-x-0 bottom-0 flex flex-col items-start gap-1 bg-ink/85 p-2 text-bg">
              <span className="font-mono text-[12px] font-bold tracking-[0.12em]">
                {reveal.higher ? '▲ HIGHER' : '▼ LOWER'}
              </span>
              <span className="ty-num text-[clamp(18px,5.4vw,26px)] leading-none font-bold">{formatBoxOffice(reveal.gross)}</span>
            </span>
          ) : null}
          {reveal?.picked ? (
            <span
              aria-hidden="true"
              className={cx(
                'absolute top-2 right-2 grid h-10 w-10 place-items-center rounded-full border-2 border-bg text-[22px] font-bold shadow-md',
                reveal.correct ? 'bg-green text-green-ink' : 'bg-red-rec text-white',
              )}
            >
              {reveal.correct ? '✓' : '✗'}
            </span>
          ) : null}
        </span>
        <span className="block min-w-0 px-0.5 pb-0.5">
          <span className="line-clamp-2 block text-[15px] leading-tight font-semibold sm:text-[17px]" title={film.title}>
            {film.title}
          </span>
          <span className="mt-0.5 flex items-center justify-between gap-2 font-mono text-[12px] text-ink-dim">
            <span>{film.year}</span>
            {reveal?.picked ? (
              <span aria-hidden="true" className="font-bold text-ink">
                {reveal.correct ? '✓' : '✗'} Your pick
              </span>
            ) : (
              <span aria-hidden="true" className="hidden sm:inline">
                Key {key}
              </span>
            )}
          </span>
        </span>
      </button>
    </div>
  );
}
