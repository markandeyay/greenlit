import type { CSSProperties } from 'react';
import { Chip } from '@/components/ui/Chip';
import { cx } from '@/components/ui/cx';
import { verdictWords } from '@/components/ui/status';
import type { GuessFeedback } from '@/lib/types';

/** Genre chips (Section 6.4): each chip green with a check on match, gray otherwise. */
export function GenreChips({
  genres,
  index,
  animate = false,
  className,
}: {
  genres: GuessFeedback['genres'];
  index?: number;
  animate?: boolean;
  className?: string;
}) {
  if (genres.length === 0) return null;
  return (
    <ul
      aria-label="Genres"
      className={cx('flex flex-wrap gap-1.5', animate && 'anim-flip', className)}
      style={index !== undefined ? ({ '--i': index } as CSSProperties) : undefined}
    >
      {genres.map((g) => (
        <li key={g.id}>
          <Chip status={g.verdict}>
            {g.name}
            <span className="sr-only">, {verdictWords(g.verdict)}</span>
          </Chip>
        </li>
      ))}
    </ul>
  );
}

/** Neutral summary cell: how many of the answer's genres this take matched. Information, no status color. */
export function GenreCountCell({
  genres,
  genreCount,
  index,
  animate = false,
}: {
  genres: GuessFeedback['genres'];
  genreCount: number;
  index?: number;
  animate?: boolean;
}) {
  const matched = genres.filter((g) => g.verdict === 'match').length;
  return (
    <div
      role="img"
      aria-label={`Genres: ${matched} of the answer's ${genreCount} genres matched.`}
      className={cx('gm-info-cell', animate && 'anim-flip')}
      style={index !== undefined ? ({ '--i': index } as CSSProperties) : undefined}
    >
      <span className="gl-cell__label">Genres</span>
      <span className="gl-cell__value">
        {matched}
        <span className="text-ink-dim"> / {genreCount}</span>
      </span>
      <span className="gl-cell__dir text-ink-dim">matched</span>
    </div>
  );
}
