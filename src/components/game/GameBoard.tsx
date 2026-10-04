'use client';

import './game.css';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { COPY } from '@/config/brand';
import { RULES } from '@/config/rules';
import { CallSheet, CallSheetStrip } from '@/components/callsheet';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { IconHelp } from '@/components/ui/icons';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useGame } from '@/lib/game/useGame';
import { describeTake } from '@/lib/game/state';
import { markHowtoSeen, shouldAutoOpenHowto } from '@/lib/game/howto';
import type { HintSlot, HintType, ClassicKind, PlayStateResponse, RegionCode, SearchResult } from '@/lib/types';
import { GiveUp } from './GiveUp';
import { GuessRow, PendingRow } from './GuessRow';
import { HowToPlaySheet } from './HowToPlaySheet';
import { ResultCard } from './ResultCard';
import { ScriptNotes } from './ScriptNotes';
import { SearchBox } from './SearchBox';
import { Slate } from './Slate';

export interface GameBoardProps {
  kind: ClassicKind;
  /** Puzzle number as a string, or the pitch slug. */
  gameRef: string;
  reelNumber: number | null;
  date: string | null;
  theme: string | null;
  /** Context for the slate, read by screen readers, e.g. "Today's reel". */
  kicker: string;
  /** Slate title (h1). */
  title: ReactNode;
  playerRegion?: RegionCode;
  /** Optional block under the slate (e.g. the pitch intro). Keep it to one short line. */
  intro?: ReactNode;
  /** Server-rendered play state (no answer unless the play is finished). */
  initialPlay?: PlayStateResponse | null;
  /** Unlimited (Dailies Reel): shows a "Next reel" action on the result card. */
  onNextReel?: () => void;
}

/**
 * The game (Sections 4.1, 6.5), game first: a compact slate, the search, then the takes (newest
 * on top). Script Notes and Walk away sit on one quiet line under the search. The Call Sheet is a
 * one-line sticky strip on mobile and a sticky side panel at >= 1024px. State comes from the API
 * only; the answer is known only once the server sends the reveal.
 */
export function GameBoard({ kind, gameRef, reelNumber, date, theme, kicker, title, playerRegion, intro, initialPlay, onNextReel }: GameBoardProps) {
  const { toast } = useToast();
  const onError = useCallback((m: string) => toast(m), [toast]);
  const { state, target, guess, giveUp, revealHint, reload } = useGame({ kind, gameRef, onError, initialPlay });
  const searchRef = useRef<HTMLInputElement | null>(null);
  const resultHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const autoFocused = useRef(false);
  const [highlight, setHighlight] = useState<{ indices: number[]; rowId: string | null }>({ indices: [], rowId: null });
  const [freshSlots, setFreshSlots] = useState<ReadonlySet<HintSlot>>(new Set());
  const [howto, setHowto] = useState(false);

  const take = state.feedback.length;
  const finished = state.status !== 'in_progress';
  const ready = state.phase === 'ready';
  const guessedIds = useMemo(() => new Set(state.feedback.map((f) => f.filmId)), [state.feedback]);
  const clapKey = Math.max(0, take - state.animateFrom);
  const last = state.feedback[take - 1];
  const announcement = last && take > state.animateFrom ? describeTake(last, take) : '';
  const fresh = ready && take === 0 && !finished;

  // First visit: open the quick rules once the empty board is on screen.
  useEffect(() => {
    if (!fresh || !shouldAutoOpenHowto()) return;
    const t = window.setTimeout(() => setHowto(true), 250);
    return () => window.clearTimeout(t);
  }, [fresh]);

  const closeHowto = useCallback(() => {
    setHowto(false);
    markHowtoSeen();
  }, []);

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

  const left = RULES.maxGuesses - take;
  const walkAway =
    ready && !finished && take > 0 ? (
      <>
        <span className="gm-quiet tabular-nums max-sm:sr-only">
          {left} {left === 1 ? 'take' : 'takes'} left
        </span>
        <GiveUp onConfirm={() => void giveUp()} disabled={!!state.pending || state.givingUp} take={take} maxGuesses={RULES.maxGuesses} />
      </>
    ) : null;

  return (
    <div className="gm-board">
      <div className="gm-board__main">
        <Slate
          title={title}
          kicker={kicker}
          take={take}
          date={date}
          scene={theme}
          clapKey={clapKey}
          actions={
            <IconButton
              label="How to play"
              size="sm"
              icon={<IconHelp />}
              className="gm-slate__help"
              onClick={() => setHowto(true)}
              aria-haspopup="dialog"
            />
          }
        />
        {intro}

        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {announcement}
        </p>

        {state.phase === 'loading' ? (
          // Reserve roughly the height of the search and the empty state so the page does not
          // jump (CLS) when the play state arrives.
          <div className="mt-3 min-h-[180px]" data-testid="board-loading">
            <div className="flex min-h-[60px] items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-rule">
              <Spinner label="Loading the reel" showLabel />
            </div>
          </div>
        ) : state.phase === 'error' ? (
          <div role="alert" className="mt-3 rounded-[var(--radius-lg)] border border-rule bg-surface p-5">
            <p className="ty-display text-2xl">The projector jammed</p>
            <p className="mt-2 text-ink-dim">{state.loadError}</p>
            <Button className="mt-4" variant="solid" size="sm" onClick={() => void reload()}>
              Try again
            </Button>
          </div>
        ) : finished ? (
          <div className="mt-4">
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
              onNextReel={onNextReel}
            />
          </div>
        ) : (
          <div className="mt-3">
            <SearchBox
              inputRef={searchRef}
              label={`Take ${take + 1} · Name a film`}
              hideLabel
              placeholder="Guess a movie"
              guessedIds={guessedIds}
              busy={!!state.pending || state.givingUp}
              onSelect={onSelect}
            />
          </div>
        )}

        {ready && (!finished || state.hints.length > 0) ? (
          <ScriptNotes
            className="mt-2"
            target={target}
            take={take}
            status={state.status}
            hints={state.hints}
            onReveal={onReveal}
            freshSlots={freshSlots}
            aside={walkAway}
          />
        ) : null}

        {ready && take > 0 ? <CallSheetStrip {...sheetProps} className="gm-strip sticky top-0 z-20 mt-2 lg:hidden" /> : null}

        <section aria-label="Your takes" className={finished ? 'mt-6' : 'mt-3'}>
          {finished && take > 0 ? <h2 className="gm-quiet mb-2">Your takes</h2> : null}
          {fresh && !state.pending ? <EmptyTakes onHelp={() => setHowto(true)} /> : null}
          <ol className="grid grid-cols-1 gap-2.5" reversed>
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

      <aside className="gm-board__side hidden lg:block" aria-label={COPY.callSheet}>
        <div className="sticky top-4 max-h-[calc(100dvh-2rem)] overflow-y-auto">
          {ready ? <CallSheet variant="panel" {...sheetProps} /> : null}
        </div>
      </aside>

      <HowToPlaySheet open={howto} onClose={closeHowto} />
    </div>
  );
}

function EmptyTakes({ onHelp }: { onHelp: () => void }) {
  return (
    <div className="gm-empty">
      <p>Guess any movie to start. Colors show how close you are.</p>
      <button type="button" className="gm-textbtn mt-1" onClick={onHelp} aria-haspopup="dialog">
        How to play
      </button>
    </div>
  );
}
