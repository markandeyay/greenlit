'use client';

import './game.css';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { COPY } from '@/config/brand';
import { RULES } from '@/config/rules';
import { CallSheet, CallSheetStrip } from '@/components/callsheet';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useGame } from '@/lib/game/useGame';
import { describeTake } from '@/lib/game/state';
import { pad2 } from '@/lib/format';
import type { HintSlot, HintType, PlayKind, RegionCode, SearchResult } from '@/lib/types';
import { GiveUp } from './GiveUp';
import { GuessRow, PendingRow } from './GuessRow';
import { ResultCard } from './ResultCard';
import { ScriptNotes } from './ScriptNotes';
import { SearchBox } from './SearchBox';
import { Slate } from './Slate';

export interface GameBoardProps {
  kind: PlayKind;
  /** Puzzle number as a string, or the pitch slug. */
  gameRef: string;
  reelNumber: number | null;
  date: string | null;
  theme: string | null;
  /** Slate kicker, e.g. "Today's reel". */
  kicker: string;
  /** Slate title (h1). */
  title: ReactNode;
  playerRegion?: RegionCode;
  /** Optional block under the slate (e.g. the pitch intro). */
  intro?: ReactNode;
}

/**
 * The game (Sections 4.1, 6.5): slate, search, Script Notes, Walk away and the guess list on the
 * left; the sticky Call Sheet on the right (>= 1024px) or as a strip under the search (mobile).
 * State comes from the API only; the answer is known only once the server sends the reveal.
 */
export function GameBoard({ kind, gameRef, reelNumber, date, theme, kicker, title, playerRegion, intro }: GameBoardProps) {
  const { toast } = useToast();
  const onError = useCallback((m: string) => toast(m), [toast]);
  const { state, target, guess, giveUp, revealHint, reload } = useGame({ kind, gameRef, onError });
  const searchRef = useRef<HTMLInputElement | null>(null);
  const resultHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const autoFocused = useRef(false);
  const [highlight, setHighlight] = useState<{ indices: number[]; rowId: string | null }>({ indices: [], rowId: null });
  const [freshSlots, setFreshSlots] = useState<ReadonlySet<HintSlot>>(new Set());

  const take = state.feedback.length;
  const finished = state.status !== 'in_progress';
  const ready = state.phase === 'ready';
  const guessedIds = useMemo(() => new Set(state.feedback.map((f) => f.filmId)), [state.feedback]);
  const clapKey = Math.max(0, take - state.animateFrom);
  const last = state.feedback[take - 1];
  const announcement = last && take > state.animateFrom ? describeTake(last, take) : '';

  // Focus the search once the round is loaded (desktop pointers only, so phones do not pop the keyboard).
  useEffect(() => {
    if (!ready || finished || autoFocused.current) return;
    autoFocused.current = true;
    let fine = true;
    try {
      fine = window.matchMedia?.('(pointer: fine)').matches ?? true;
    } catch {
      fine = true;
    }
    if (fine) searchRef.current?.focus({ preventScroll: true });
  }, [ready, finished]);

  // When the round ends live, move focus to the result.
  useEffect(() => {
    if (finished && state.finishedLive) resultHeadingRef.current?.focus({ preventScroll: false });
  }, [finished, state.finishedLive]);

  const onSelect = async (film: SearchResult) => {
    setHighlight({ indices: [], rowId: null });
    await guess(film);
    searchRef.current?.focus({ preventScroll: true });
  };

  const onReveal = async (slot: HintSlot, type: HintType) => {
    const ok = await revealHint(slot, type);
    if (ok) setFreshSlots((s) => new Set([...s, slot]));
    return ok;
  };

  const onRowSelect = (indices: number[], rowId: string | null) => {
    setHighlight({ indices, rowId });
    if (indices.length) {
      const newest = Math.max(...indices) + 1;
      const el = document.querySelector<HTMLElement>(`[data-take="${newest}"]`);
      el?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    }
  };

  const sheetProps = {
    feedback: state.feedback,
    reelNumber,
    take,
    maxGuesses: RULES.maxGuesses,
    highlighted: highlight.rowId,
    onRowSelect,
    playerRegion,
  };

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] lg:gap-8">
      <div className="min-w-0">
        <Slate title={title} kicker={kicker} take={take} date={date} scene={theme} clapKey={clapKey} />
        {intro}

        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {announcement}
        </p>

        {state.phase === 'loading' ? (
          // Reserve roughly the height of the search, Script Notes and empty takes so the page does
          // not jump (CLS) when the play state arrives.
          <div className="mt-6 min-h-[420px]" data-testid="board-loading">
            <div className="flex min-h-[96px] items-center justify-center border border-dashed border-rule">
              <Spinner label="Loading the reel" showLabel />
            </div>
          </div>
        ) : state.phase === 'error' ? (
          <div role="alert" className="mt-6 border border-rule bg-surface p-5">
            <p className="ty-display text-2xl">The projector jammed</p>
            <p className="mt-2 text-ink-dim">{state.loadError}</p>
            <Button className="mt-4" variant="solid" size="sm" onClick={() => void reload()}>
              Try again
            </Button>
          </div>
        ) : finished ? (
          <div className="mt-6">
            <ResultCard
              kind={kind}
              gameRef={gameRef}
              reelNumber={reelNumber}
              status={state.status as 'won' | 'lost'}
              feedback={state.feedback}
              hintsUsed={state.hints.length}
              reveal={state.reveal}
              live={state.finishedLive}
              headingRef={resultHeadingRef}
            />
          </div>
        ) : (
          <div className="mt-6">
            <SearchBox
              inputRef={searchRef}
              label={`Take ${pad2(take + 1)} · Name a film`}
              guessedIds={guessedIds}
              busy={!!state.pending || state.givingUp}
              onSelect={onSelect}
            />
          </div>
        )}

        {ready && take > 0 ? <CallSheetStrip {...sheetProps} className="sticky top-0 z-20 mt-4 lg:hidden" /> : null}

        {ready && (!finished || state.hints.length > 0) ? (
          <ScriptNotes
            className="mt-4"
            target={target}
            take={take}
            status={state.status}
            hints={state.hints}
            onReveal={onReveal}
            freshSlots={freshSlots}
          />
        ) : null}

        {ready && !finished && take > 0 ? (
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="font-mono text-[12px] text-ink-dim">
              {RULES.maxGuesses - take} {RULES.maxGuesses - take === 1 ? 'take' : 'takes'} left
            </p>
            <GiveUp onConfirm={() => void giveUp()} disabled={!!state.pending || state.givingUp} take={take} maxGuesses={RULES.maxGuesses} />
          </div>
        ) : null}

        <section aria-label="Your takes" className="mt-6">
          {ready && take === 0 && !state.pending && !finished ? <EmptyTakes /> : null}
          <ol className="grid grid-cols-1 gap-3" reversed>
            {state.pending ? (
              <li>
                <PendingRow film={state.pending} take={take + 1} />
              </li>
            ) : null}
            {state.feedback
              .map((fb, i) => ({ fb, i }))
              .reverse()
              .map(({ fb, i }) => (
                <li key={fb.filmId}>
                  <GuessRow
                    feedback={fb}
                    take={i + 1}
                    animate={i >= state.animateFrom}
                    highlighted={highlight.indices.includes(i)}
                    dimmed={highlight.indices.length > 0 && !highlight.indices.includes(i)}
                    playerRegion={playerRegion}
                  />
                </li>
              ))}
          </ol>
        </section>
      </div>

      <aside className="hidden lg:block" aria-label={COPY.callSheet}>
        <div className="sticky top-4 max-h-[calc(100dvh-2rem)] overflow-y-auto">
          {ready ? <CallSheet variant="panel" {...sheetProps} /> : null}
        </div>
      </aside>
    </div>
  );
}

function EmptyTakes() {
  return (
    <div className="border border-dashed border-rule px-5 py-8 text-center">
      <p className="ty-display text-[clamp(22px,4vw,30px)]">Quiet on set</p>
      <p className="mx-auto mt-2 max-w-[44ch] text-[15px] text-ink-dim">
        Name any film to roll your first take. Each take shows how it compares with the mystery film, and the
        Call Sheet keeps score of everything you learn.
      </p>
    </div>
  );
}
