'use client';
// Client hook for GET /api/me. One fetch per page view, shared by every component that asks.
import { useCallback, useSyncExternalStore } from 'react';
import type { MeResponse } from './types';

type State = { status: 'idle' | 'loading' | 'ready' | 'error'; data: MeResponse | null };

let state: State = { status: 'idle', data: null };
const listeners = new Set<() => void>();
const SERVER_STATE: State = { status: 'idle', data: null };

function set(next: State) {
  state = next;
  for (const l of listeners) l();
}

export async function loadMe(force = false): Promise<MeResponse | null> {
  if (!force && (state.status === 'loading' || state.status === 'ready')) return state.data;
  set({ status: 'loading', data: state.data });
  try {
    const res = await fetch('/api/me', { cache: 'no-store', credentials: 'same-origin' });
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as MeResponse;
    set({ status: 'ready', data });
    return data;
  } catch {
    set({ status: 'error', data: null });
    return null;
  }
}

function subscribe(l: () => void) {
  listeners.add(l);
  if (state.status === 'idle') void loadMe();
  return () => {
    listeners.delete(l);
  };
}

export function useMe(): State & { refresh: () => Promise<MeResponse | null> } {
  const s = useSyncExternalStore(
    subscribe,
    () => state,
    () => SERVER_STATE,
  );
  const refresh = useCallback(() => loadMe(true), []);
  return { ...s, refresh };
}

/** Tests only. */
export function __resetMeForTests(): void {
  state = { status: 'idle', data: null };
}
