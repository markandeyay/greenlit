import { useId } from 'react';
import { RULES } from '@/config/rules';
import { Tag } from '@/components/ui/Tag';
import { cx } from '@/components/ui/cx';
import { pad2 } from '@/lib/format';
import type { GuessFeedback, RegionCode, SearchResult } from '@/lib/types';
import { GenreChips, GenreCountCell } from './GenreChips';
import { RatingCell, StudioCell } from './LabelCell';
import { NumberCell } from './NumberCell';
import { PersonCell } from './PersonCell';
import { Poster } from './Poster';

/** Cells start flipping after the slate clap: this many stagger steps of lead-in. */
export const CLAP_LEAD_IN = 3;

export interface GuessRowProps {
  feedback: GuessFeedback;
  /** 1-based take number. */
  take: number;
  /** Play the slate-then-flip reveal (new rows only; never on resume). */
  animate?: boolean;
  /** Highlighted from a Call Sheet row. */
  highlighted?: boolean;
  /** Another row is highlighted, so this one recedes. */
  dimmed?: boolean;
  playerRegion?: RegionCode;
  className?: string;
}

/**
 * One take (Sections 4.2, 6.4, 6.5): poster + title, then People (director, lead, supporting x4
 * with dashed empty slots), Numbers (year, box office, score), Labels (rating, studio), and
 * genre chips. Cells flip left to right with an 80ms stagger after the slate clap.
 */
export function GuessRow({
  feedback: fb,
  take,
  animate = false,
  highlighted = false,
  dimmed = false,
  playerRegion,
  className,
}: GuessRowProps) {
  const titleId = useId();
  const supporting = Array.from({ length: RULES.maxSupportingCast }, (_, i) => fb.supporting[i] ?? null);
  const at = (i: number) => (animate ? i + CLAP_LEAD_IN : undefined);
  const directorPerson = {
    name: fb.director.display,
    profilePath: null,
    verdict: fb.director.verdict,
  };

  return (
    <article
      aria-labelledby={titleId}
      className={cx('gm-row p-3 sm:p-4', className)}
      data-highlighted={highlighted || undefined}
      data-dim={dimmed || undefined}
      data-new={animate || undefined}
      data-take={take}
    >
      <header className="flex items-center gap-3">
        <Poster title={fb.title} year={fb.year.value} posterPath={fb.posterPath} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="ty-micro text-ink-dim">
            Take <span className="text-ink tabular-nums">{pad2(take)}</span>
            <span aria-hidden="true"> / {pad2(RULES.maxGuesses)}</span>
          </p>
          <h3 id={titleId} className="ty-display mt-1 truncate text-[clamp(20px,5vw,28px)] leading-none">
            {fb.title}
            {fb.year.value ? (
              <span className="ml-2 font-mono text-[0.6em] font-bold tracking-normal text-ink-dim">
                {fb.year.value}
              </span>
            ) : null}
          </h3>
        </div>
        <div className="flex flex-none flex-col items-end gap-1">
          {fb.isCorrect ? <Tag tone="solid">That&apos;s the film</Tag> : null}
          {highlighted ? <Tag>From the call sheet</Tag> : null}
        </div>
      </header>

      <div className="mt-3">
        <div role="group" aria-label="People" className="gm-people">
          <PersonCell
            role="director"
            person={directorPerson}
            unitSize={fb.director.personIds.length}
            index={at(0)}
            animate={animate}
          />
          <span className="gm-people__sep" aria-hidden="true" />
          <PersonCell role="lead" person={fb.lead} index={at(1)} animate={animate} />
          <span className="gm-people__sep" aria-hidden="true" />
          {supporting.map((p, i) => (
            <PersonCell
              key={p ? `p${p.personId}` : `empty${i}`}
              role="supporting"
              slot={i + 1}
              person={p}
              index={at(2 + i)}
              animate={animate}
            />
          ))}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2 sm:gap-2">
        <div role="group" aria-label="Numbers" className="grid grid-cols-3 gap-1.5 sm:gap-2">
          <NumberCell attribute="year" feedback={fb.year} index={at(6)} animate={animate} />
          <NumberCell attribute="boxOffice" feedback={fb.boxOffice} index={at(7)} animate={animate} />
          <NumberCell attribute="score" feedback={fb.score} index={at(8)} animate={animate} />
        </div>
        <div role="group" aria-label="Labels" className="grid grid-cols-3 gap-1.5 sm:gap-2">
          <RatingCell rating={fb.rating} playerRegion={playerRegion} index={at(9)} animate={animate} />
          <StudioCell studio={fb.studio} index={at(10)} animate={animate} />
          <GenreCountCell genres={fb.genres} genreCount={fb.genreCount} index={at(11)} animate={animate} />
        </div>
      </div>

      <GenreChips genres={fb.genres} className="mt-3" index={at(12)} animate={animate} />
    </article>
  );
}

/** Optimistic row while a take is in flight. */
export function PendingRow({ film, take }: { film: SearchResult; take: number }) {
  return (
    <article aria-busy="true" aria-label={`Take ${take}: ${film.title}, rolling`} className="gm-row gm-pending p-3 sm:p-4">
      <div className="flex items-center gap-3">
        <Poster title={film.title} year={film.year} posterPath={film.posterPath} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="ty-micro text-ink-dim">
            Take <span className="text-ink tabular-nums">{pad2(take)}</span> · Rolling
          </p>
          <p className="ty-display mt-1 truncate text-[clamp(20px,5vw,28px)] leading-none">
            {film.title}
            <span className="ml-2 font-mono text-[0.6em] font-bold tracking-normal text-ink-dim">{film.year}</span>
          </p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-6 gap-2" aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-14 rounded-[3px] border border-dashed border-rule" />
        ))}
      </div>
    </article>
  );
}
