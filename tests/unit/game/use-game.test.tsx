// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { GameApiError, type GameApi } from '@/lib/game/api';
import { useGame } from '@/lib/game/useGame';
import type { Reveal } from '@/lib/types';
import { fb } from './fixtures';

const recordLocalPlay = vi.fn();
vi.mock('@/lib/local-stats', () => ({ recordLocalPlay: (r: unknown) => recordLocalPlay(r) }));

afterEach(cleanup);
beforeEach(() => recordLocalPlay.mockClear());

const reveal: Reveal = { filmId: 9, title: 'X', year: 2000, posterPath: null, director: 'D', tagline: null, trailerYoutube: null };

function fakeApi(over: Partial<GameApi> = {}): GameApi {
  return {
    today: vi.fn(),
    search: vi.fn(),
    play: vi.fn(async () => ({ kind: 'daily' as const, ref: '4', status: 'in_progress' as const, take: 0, feedback: [], hints: [] })),
    guess: vi.fn(),
    giveUp: vi.fn(async () => ({ status: 'lost' as const, reveal })),
    hintOptions: vi.fn(),
    hint: vi.fn(async () => ({ hint: { type: 'tagline' as const, payload: { text: 'hi' } } })),
    dailyStats: vi.fn(),
    ...over,
  } as unknown as GameApi;
}

describe('useGame', () => {
  it('resumes from /api/play on mount', async () => {
    const api = fakeApi({
      play: vi.fn(async () => ({ kind: 'daily' as const, ref: '4', status: 'in_progress' as const, take: 1, feedback: [fb()], hints: [] })),
    });
    const { result } = renderHook(() => useGame({ kind: 'daily', gameRef: '4', api }));
    await waitFor(() => expect(result.current.state.phase).toBe('ready'));
    expect(api.play).toHaveBeenCalledWith({ kind: 'daily', ref: '4' });
    expect(result.current.state.feedback).toHaveLength(1);
    expect(result.current.state.animateFrom).toBe(1);
    expect(recordLocalPlay).not.toHaveBeenCalled();
  });

  it('appends guesses and records the finish exactly once', async () => {
    let n = 0;
    const api = fakeApi({
      guess: vi.fn(async (_t, filmId: number) => {
        n++;
        return n === 2
          ? { feedback: fb({ filmId, isCorrect: true }), take: 2, status: 'won' as const, reveal }
          : { feedback: fb({ filmId }), take: 1, status: 'in_progress' as const };
      }),
    });
    const { result, rerender } = renderHook(() => useGame({ kind: 'daily', gameRef: '4', api }));
    await waitFor(() => expect(result.current.state.phase).toBe('ready'));
    await act(async () => {
      await result.current.guess({ id: 11, title: 'A', year: 2000, posterPath: null });
    });
    expect(result.current.state.feedback.map((f) => f.filmId)).toEqual([11]);
    expect(recordLocalPlay).not.toHaveBeenCalled();
    await act(async () => {
      await result.current.guess({ id: 12, title: 'B', year: 2001, posterPath: null });
    });
    expect(result.current.state.status).toBe('won');
    expect(result.current.state.reveal).toEqual(reveal);
    rerender();
    rerender();
    expect(recordLocalPlay).toHaveBeenCalledTimes(1);
    expect(recordLocalPlay.mock.calls[0]![0]).toMatchObject({ kind: 'daily', ref: '4', status: 'won', takes: 2, hintsUsed: 0 });
  });

  it('records a resumed finished play once', async () => {
    const api = fakeApi({
      play: vi.fn(async () => ({ kind: 'vault' as const, ref: '2', status: 'lost' as const, take: 1, feedback: [fb()], hints: [], reveal })),
    });
    const { result } = renderHook(() => useGame({ kind: 'vault', gameRef: '2', api }));
    await waitFor(() => expect(result.current.state.status).toBe('lost'));
    expect(result.current.state.finishedLive).toBe(false);
    expect(recordLocalPlay).toHaveBeenCalledTimes(1);
  });

  it('reports friendly errors and resyncs after already_guessed', async () => {
    const onError = vi.fn();
    const api = fakeApi({ guess: vi.fn(async () => Promise.reject(new GameApiError('already_guessed', 'dup', 409))) });
    const { result } = renderHook(() => useGame({ kind: 'daily', gameRef: '4', api, onError }));
    await waitFor(() => expect(result.current.state.phase).toBe('ready'));
    let ok = true;
    await act(async () => {
      ok = await result.current.guess({ id: 11, title: 'A', year: 2000, posterPath: null });
    });
    expect(ok).toBe(false);
    expect(result.current.state.pending).toBeNull();
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('already shot'));
    expect(api.play).toHaveBeenCalledTimes(2);
  });

  it('gives up and reveals', async () => {
    const api = fakeApi();
    const { result } = renderHook(() => useGame({ kind: 'daily', gameRef: '4', api }));
    await waitFor(() => expect(result.current.state.phase).toBe('ready'));
    await act(async () => {
      await result.current.giveUp();
    });
    expect(result.current.state.status).toBe('lost');
    expect(result.current.state.reveal).toEqual(reveal);
    expect(recordLocalPlay).toHaveBeenCalledTimes(1);
  });

  it('shows a load error when resume fails', async () => {
    const api = fakeApi({ play: vi.fn(async () => Promise.reject(new GameApiError('network', 'x'))) });
    const { result } = renderHook(() => useGame({ kind: 'daily', gameRef: '4', api }));
    await waitFor(() => expect(result.current.state.phase).toBe('error'));
    expect(result.current.state.loadError).toMatch(/connection/);
  });
});
