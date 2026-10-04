'use client';
// Client game state hook (WS5): resume on mount, optimistic guesses, give up, notes, and a single
// local record when the round finishes.
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { recordLocalPlay } from '@/lib/local-stats';
import type { HintSlot, HintType, ClassicKind, PlayStateResponse, SearchResult } from '@/lib/types';
import { GameApiError, friendlyError, gameApi, type GameApi, type Target } from './api';
import { gameReducer, initialGameState, isFinished, localRecordFor } from './state';

export interface UseGameOptions {
  kind: ClassicKind;
  gameRef: string;
  api?: GameApi;
  /** Called with friendly copy when something fails. */
  onError?: (message: string) => void;
  /** Server-rendered play state for the first paint (skips the initial fetch). */
  initialPlay?: PlayStateResponse | null;
}

export function useGame({ kind, gameRef, api = gameApi, onError, initialPlay }: UseGameOptions) {
  const [state, dispatch] = useReducer(gameReducer, initialPlay ?? null, (play) =>
    play ? gameReducer(initialGameState, { type: 'resumed', play }) : initialGameState,
  );
  const hasInitial = useRef(Boolean(initialPlay));
  const target: Target = useMemo(() => ({ kind, ref: gameRef }), [kind, gameRef]);
  const recorded = useRef(false);
  const inFlight = useRef(false);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const resync = useCallback(async () => {
    try {
      dispatch({ type: 'resumed', play: await api.play(target) });
    } catch {
      /* keep current state */
    }
  }, [api, target]);

  const load = useCallback(async () => {
    try {
      dispatch({ type: 'resumed', play: await api.play(target) });
    } catch (e) {
      dispatch({ type: 'load_failed', message: friendlyError(e) });
    }
  }, [api, target]);

  useEffect(() => {
    if (hasInitial.current) {
      hasInitial.current = false;
      return;
    }
    void load();
  }, [load]);

  // Record the finished round on this device exactly once (resumed finished plays too).
  const finished = state.phase === 'ready' && isFinished(state);
  useEffect(() => {
    if (!finished || recorded.current) return;
    const rec = localRecordFor(kind, gameRef, state);
    if (!rec) return;
    recorded.current = true;
    recordLocalPlay(rec);
  }, [finished, kind, gameRef, state]);

  const guess = useCallback(
    async (film: SearchResult): Promise<boolean> => {
      if (inFlight.current) return false;
      inFlight.current = true;
      dispatch({ type: 'guess_started', film });
      try {
        const res = await api.guess(target, film.id);
        dispatch({ type: 'guess_succeeded', res });
        return true;
      } catch (e) {
        dispatch({ type: 'guess_failed' });
        onErrorRef.current?.(friendlyError(e));
        if (e instanceof GameApiError && (e.code === 'already_guessed' || e.code === 'game_over')) await resync();
        return false;
      } finally {
        inFlight.current = false;
      }
    },
    [api, target, resync],
  );

  const giveUp = useCallback(async (): Promise<boolean> => {
    dispatch({ type: 'giveup_started' });
    try {
      dispatch({ type: 'giveup_succeeded', res: await api.giveUp(target) });
      return true;
    } catch (e) {
      dispatch({ type: 'giveup_failed' });
      onErrorRef.current?.(friendlyError(e));
      if (e instanceof GameApiError && e.code === 'game_over') await resync();
      return false;
    }
  }, [api, target, resync]);

  const revealHint = useCallback(
    async (slot: HintSlot, type: HintType): Promise<boolean> => {
      try {
        const res = await api.hint(target, slot, type);
        dispatch({ type: 'hint_revealed', used: { slot, hint: res.hint } });
        return true;
      } catch (e) {
        onErrorRef.current?.(friendlyError(e));
        return false;
      }
    },
    [api, target],
  );

  return { state, target, guess, giveUp, revealHint, reload: load };
}
