'use client';

import { useSyncExternalStore } from 'react';
import { COPY } from '@/config/brand';
import { localKey, readLocalStats } from '@/lib/local-stats';
import type { LocalPlayRecord, PlayKind } from '@/lib/types';

const subscribe = (cb: () => void) => {
  window.addEventListener('storage', cb);
  return () => window.removeEventListener('storage', cb);
};

/** This device's result for a reel (from localStorage), as a small text badge. Nothing on the server render. */
export function VaultResultBadge({ refs }: { refs: Array<{ kind: PlayKind; ref: string }> }) {
  const raw = useSyncExternalStore(
    subscribe,
    () => {
      const file = readLocalStats();
      for (const r of refs) {
        const rec = file.records[localKey(r.kind, r.ref)];
        if (rec) return JSON.stringify(rec);
      }
      return '';
    },
    () => '',
  );
  if (!raw) return null;
  const rec = JSON.parse(raw) as LocalPlayRecord;
  const won = rec.status === 'won';
  return (
    <span className={won ? 'gl-tag gl-tag--solid' : 'gl-tag gl-tag--dim'}>
      {won ? `${COPY.winStamp} · ${rec.takes} TK` : 'Turnaround'}
      {rec.hintsUsed > 0 ? <span aria-label=", notes used"> 📝</span> : null}
    </span>
  );
}
