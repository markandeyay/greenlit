'use client';

import { useId, useMemo, type ReactNode } from 'react';
import { COPY } from '@/config/brand';
import { REGIONS } from '@/config/regions';
import { computeCallSheet, type CallSheetState, type NumericRange } from '@/lib/callsheet';
import { rangeBarModel } from '@/lib/callsheet/domain';
import { describeRange, describeRangeAccessible, formatNumericValue } from '@/lib/callsheet/format';
import type { GuessFeedback, RegionCode } from '@/lib/types';
import { RangeBar } from './RangeBar';

/**
 * Row ids: 'director', 'cast:<personId>' (confirmed actor), 'cast:cut', 'year', 'boxOffice',
 * 'score', 'rating', 'studio', 'genres'.
 */
export type CallSheetRowId = string;

export interface CallSheetProps {
  /** Feedback so far, oldest first. The sheet never sees the answer. */
  feedback: readonly GuessFeedback[];
  reelNumber: number;
  /** Takes used so far (usually feedback.length). */
  take: number;
  maxGuesses: number;
  /** Currently selected row id (drives the pressed state). */
  highlighted?: CallSheetRowId | null;
  /**
   * Called when a row is toggled. `guessIndices` are 0-based indices into `feedback`.
   * Toggling the already highlighted row calls `onRowSelect([], null)`.
   * When omitted, rows render as plain (non-interactive) labels.
   */
  onRowSelect?: (guessIndices: number[], rowId: CallSheetRowId | null) => void;
  /** Player's region; a rating confirmed under a different region shows a small region tag. */
  playerRegion?: RegionCode;
  variant?: 'panel' | 'drawer';
  /** Precomputed state (optional, to share one computation with the mobile strip). */
  state?: CallSheetState;
  className?: string;
}

// ---------------------------------------------------------------------------
// Small presentational pieces
// ---------------------------------------------------------------------------

export function ConfirmedTag() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-sm bg-green px-1.5 py-px font-mono text-[11px] font-bold tracking-wider text-green-ink">
      <span aria-hidden="true">✓</span>
      {COPY.confirmed}
    </span>
  );
}

export function CutTag() {
  return (
    <span className="inline-flex shrink-0 items-center rounded-sm border border-rule px-1.5 py-px font-mono text-[11px] font-bold tracking-wider text-ink-dim">
      {COPY.ruledOut}
    </span>
  );
}

function Struck({ children }: { children: ReactNode }) {
  return <s className="text-ink-dim decoration-ink-dim decoration-2">{children}</s>;
}

function Dim({ children }: { children: ReactNode }) {
  return <span className="text-ink-dim">{children}</span>;
}

interface Row {
  id: CallSheetRowId;
  label: string;
  /** Continuation rows (e.g. a second cast line) hide the label visually. */
  continuation?: boolean;
  guessIndices: number[];
  content: ReactNode;
}

function NumericCell({ range }: { range: NumericRange }) {
  const model = rangeBarModel(range);
  const text = describeRange(range);
  const confirmedExact = range.status === 'exact';
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span
          className={[
            'font-mono tabular-nums',
            range.status === 'unknown' ? 'text-ink-dim' : '',
            range.status === 'conflict' ? 'text-ink' : '',
          ].join(' ')}
        >
          {range.status === 'conflict' ? <span aria-hidden="true">! </span> : null}
          {text}
        </span>
        {confirmedExact ? <ConfirmedTag /> : null}
      </div>
      {model && range.status !== 'exact' && range.status !== 'conflict' ? (
        <RangeBar
          label={describeRangeAccessible(range)}
          domain={model.domain}
          lo={model.lo}
          hi={model.hi}
          ticks={model.ticks}
          scale={model.scale}
          formatEdge={(v) => formatNumericValue(range.attribute, v)}
        />
      ) : null}
    </div>
  );
}

function buildRows(s: CallSheetState, playerRegion: RegionCode | undefined): Row[] {
  const rows: Row[] = [];

  // Director
  if (s.director.confirmed) {
    rows.push({
      id: 'director',
      label: 'Director',
      guessIndices: s.director.guessIndices,
      content: (
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{s.director.confirmed.display}</span>
          <ConfirmedTag />
        </span>
      ),
    });
  } else {
    rows.push({
      id: 'director',
      label: 'Director',
      guessIndices: s.director.guessIndices,
      content:
        s.director.cut.length === 0 ? (
          <Dim>Unknown</Dim>
        ) : (
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <CutTag />
            {s.director.cut.map((d, i) => (
              <span key={d.personIds.join(',') || d.display}>
                <Struck>{d.display}</Struck>
                {i < s.director.cut.length - 1 ? <Dim>,</Dim> : null}
              </span>
            ))}
          </span>
        ),
    });
  }

  // Cast: one line per confirmed actor, then one line with every cut actor.
  const castRows: Row[] = s.cast.confirmed.map((c) => ({
    id: `cast:${c.personId}`,
    label: 'Cast',
    guessIndices: c.guessIndices,
    content: (
      <span className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{c.name}</span>
        {c.answerRole === 'lead' || c.answerRole === 'supp' ? (
          <span className="rounded-sm border border-rule px-1 font-mono text-[10px] tracking-wider text-ink-dim">
            {c.answerRole === 'lead' ? 'LEAD' : 'SUPP'}
          </span>
        ) : null}
        <ConfirmedTag />
      </span>
    ),
  }));
  if (s.cast.cut.length > 0) {
    castRows.push({
      id: 'cast:cut',
      label: 'Cast',
      guessIndices: [...new Set(s.cast.cut.flatMap((c) => c.guessIndices))].sort((a, b) => a - b),
      content: (
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <CutTag />
          {s.cast.cut.map((c, i) => (
            <span key={c.personId}>
              <Struck>{c.name}</Struck>
              {i < s.cast.cut.length - 1 ? <Dim>,</Dim> : null}
            </span>
          ))}
        </span>
      ),
    });
  }
  if (castRows.length === 0) {
    castRows.push({ id: 'cast:cut', label: 'Cast', guessIndices: [], content: <Dim>Unknown</Dim> });
  }
  castRows.forEach((r, i) => rows.push({ ...r, continuation: i > 0 }));

  // Numbers
  rows.push({ id: 'year', label: 'Year', guessIndices: s.year.guessIndices, content: <NumericCell range={s.year} /> });
  rows.push({
    id: 'boxOffice',
    label: 'Box office',
    guessIndices: s.boxOffice.guessIndices,
    content: <NumericCell range={s.boxOffice} />,
  });
  rows.push({ id: 'score', label: 'Score', guessIndices: s.score.guessIndices, content: <NumericCell range={s.score} /> });

  // Rating
  const rc = s.rating.confirmed;
  rows.push({
    id: 'rating',
    label: 'Rating',
    guessIndices: s.rating.guessIndices,
    content: rc ? (
      <span className="flex flex-wrap items-center gap-2">
        <span className="font-mono font-semibold">{rc.value}</span>
        {playerRegion && rc.region !== playerRegion ? (
          <span
            className="rounded-sm border border-rule px-1 font-mono text-[10px] tracking-wider text-ink-dim"
            title={`${REGIONS[rc.region].board} rating`}
          >
            {REGIONS[rc.region].label}
          </span>
        ) : null}
        <ConfirmedTag />
      </span>
    ) : s.rating.cut.length > 0 ? (
      <Dim>{s.rating.cut.map((r) => `not ${r.value}`).join(', ')}</Dim>
    ) : (
      <Dim>Unknown</Dim>
    ),
  });

  // Studio
  const sc = s.studio.confirmed;
  rows.push({
    id: 'studio',
    label: 'Studio',
    guessIndices: s.studio.guessIndices,
    content: sc ? (
      <span className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{sc.name}</span>
        <ConfirmedTag />
      </span>
    ) : s.studio.cut.length > 0 ? (
      <Dim>{s.studio.cut.map((st) => `not ${st.name}`).join(', ')}</Dim>
    ) : (
      <Dim>Unknown</Dim>
    ),
  });

  // Genres
  const g = s.genres;
  rows.push({
    id: 'genres',
    label: 'Genres',
    guessIndices: g.guessIndices,
    content:
      g.total === null ? (
        <Dim>Unknown</Dim>
      ) : (
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {g.confirmed.length > 0 ? (
            <>
              <span className="font-semibold">{g.confirmed.map((x) => x.name).join(', ')}</span>
              <ConfirmedTag />
              <span aria-hidden="true" className="text-ink-dim">·</span>
            </>
          ) : null}
          <span className="font-mono tabular-nums">
            {g.total} {g.total === 1 ? 'genre' : 'genres'} total
            {g.remaining !== null && g.remaining > 0 && g.confirmed.length > 0 ? `, ${g.remaining} unknown` : ''}
          </span>
          {g.cut.length > 0 ? (
            <>
              <span aria-hidden="true" className="text-ink-dim">·</span>
              <Dim>ruled out: {g.cut.map((x) => x.name).join(', ')}</Dim>
            </>
          ) : null}
        </span>
      ),
  });

  return rows;
}

// ---------------------------------------------------------------------------
// The sheet
// ---------------------------------------------------------------------------

export function CallSheetHeader({ reelNumber, take, maxGuesses, id }: { reelNumber: number; take: number; maxGuesses: number; id?: string }) {
  return (
    <h2 id={id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 font-mono text-xs tracking-widest text-ink">
      <span className="font-display text-sm font-bold">{COPY.callSheet}</span>
      <span aria-hidden="true" className="text-ink-dim">·</span>
      <span className="tabular-nums">{COPY.reelLabel(reelNumber)}</span>
      <span aria-hidden="true" className="text-ink-dim">·</span>
      <span className="tabular-nums">{COPY.takeLabel(take, maxGuesses)}</span>
    </h2>
  );
}

export function CallSheet({
  feedback,
  reelNumber,
  take,
  maxGuesses,
  highlighted = null,
  onRowSelect,
  playerRegion,
  variant = 'panel',
  state: precomputed,
  className,
}: CallSheetProps) {
  const headingId = useId();
  const state = useMemo(() => precomputed ?? computeCallSheet(feedback), [precomputed, feedback]);
  const rows = useMemo(() => buildRows(state, playerRegion), [state, playerRegion]);
  const empty = state.guessCount === 0;

  const select = (row: Row) => {
    if (!onRowSelect) return;
    if (highlighted === row.id) onRowSelect([], null);
    else onRowSelect(row.guessIndices, row.id);
  };

  return (
    <section
      aria-labelledby={headingId}
      data-variant={variant}
      className={[
        'bg-surface text-ink',
        variant === 'panel' ? 'rounded-sm border border-rule shadow-[0_0_0_1px_var(--bg)]' : 'border-y border-rule',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="border-b-4 border-double border-rule px-3 py-2.5 sm:px-4">
        <CallSheetHeader id={headingId} reelNumber={reelNumber} take={take} maxGuesses={maxGuesses} />
      </div>

      {empty ? (
        <div className="border-b border-rule px-3 py-3 sm:px-4">
          <p className="font-mono text-[11px] tracking-widest text-ink-dim">01</p>
          <p className="font-display text-base font-bold uppercase tracking-tight">INT. THE CALL SHEET - NIGHT</p>
          <p className="mt-1 text-sm text-ink-dim">
            Nothing on the sheet <em className="font-serif">yet</em>. Make your first take and every clue lands here.
          </p>
        </div>
      ) : null}

      {state.conflict ? (
        <p role="status" className="border-b border-rule px-3 py-2 text-xs text-ink sm:px-4">
          <span aria-hidden="true">! </span>Some clues contradict each other. Ranges marked &quot;Clues conflict&quot; are unreliable.
        </p>
      ) : null}

      <table aria-labelledby={headingId} className="w-full border-collapse text-sm">
        <thead className="sr-only">
          <tr>
            <th scope="col">Attribute</th>
            <th scope="col">What we know</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isOn = highlighted === row.id;
            const interactive = !!onRowSelect && row.guessIndices.length > 0;
            return (
              <tr
                key={row.id}
                data-row={row.id}
                data-highlighted={isOn || undefined}
                className={[
                  row.continuation ? '' : 'border-t border-rule first:border-t-0',
                  'align-top motion-safe:transition-colors',
                  isOn ? 'bg-surface-2' : '',
                ].join(' ')}
              >
                <th
                  scope="row"
                  className={[
                    'w-[6.5rem] py-2 pl-3 pr-2 text-left font-mono text-[11px] font-normal uppercase tracking-widest text-ink-dim sm:w-28 sm:pl-4',
                    isOn ? 'shadow-[inset_3px_0_0_var(--ink)]' : '',
                  ].join(' ')}
                >
                  {interactive ? (
                    <button
                      type="button"
                      aria-pressed={isOn}
                      onClick={() => select(row)}
                      className="-mx-1 -my-0.5 rounded-sm px-1 py-0.5 text-left uppercase hover:text-ink focus-visible:text-ink"
                    >
                      <span className={row.continuation ? 'sr-only' : undefined}>{row.label}</span>
                      {row.continuation ? <span aria-hidden="true">&nbsp;</span> : null}
                      <span className="sr-only">
                        {`, highlight ${row.guessIndices.length} ${row.guessIndices.length === 1 ? 'guess' : 'guesses'}`}
                      </span>
                    </button>
                  ) : (
                    <span className={row.continuation ? 'sr-only' : undefined}>{row.label}</span>
                  )}
                </th>
                <td className="min-w-0 py-2 pr-3 sm:pr-4">{empty ? <Dim>TBD</Dim> : row.content}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
