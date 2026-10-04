import { useSyncExternalStore } from 'react';

const noop = () => () => {};

/** False during SSR and hydration, true after. Use to render client-only values (clocks,
 *  localStorage) without hydration mismatches. */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
