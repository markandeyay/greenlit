'use client';

import { useEffect } from 'react';
import { Button, ButtonLink } from '@/components/ui/Button';

/** Route-level error boundary UI for game pages. */
export function GameError({ error, retry }: { error: Error & { digest?: string }; retry?: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="l-page gl-page">
      <div role="alert" className="border-[1.5px] border-ink bg-surface p-6">
        <p className="ty-label">Cut</p>
        <h1 className="ty-display mt-2 text-[length:var(--t-d2)]">The projector jammed</h1>
        <p className="mt-3 max-w-[52ch] text-ink-dim">
          Something went wrong loading this reel. Your takes are safe on the server; try again.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {retry ? (
            <Button variant="solid" onClick={() => retry()}>
              Try again
            </Button>
          ) : null}
          <ButtonLink href="/">Today&apos;s reel</ButtonLink>
        </div>
      </div>
    </main>
  );
}
