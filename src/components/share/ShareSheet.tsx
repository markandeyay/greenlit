'use client';
// Placeholder (WS0). WS6 replaces this with the real share sheet; the props are the contract.
import type { ShareSheetProps } from './types';

export function ShareSheet(props: ShareSheetProps) {
  return <div className={props.className} data-share-placeholder />;
}
