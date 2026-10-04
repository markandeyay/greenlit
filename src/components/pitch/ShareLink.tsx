'use client';
// The share link for a fresh pitch: readonly URL field, Copy (clipboard with a select-and-copy
// fallback) and Share (Web Share API, shown only where supported). Share text never names the film.
import { useEffect, useId, useRef, useState } from 'react';
import { APP_NAME } from '@/config/brand';
import { RULES } from '@/config/rules';
import { Button } from '@/components/ui/Button';

export function pitchShareText(): string {
  return `I pitched you a film on ${APP_NAME}. Can you guess it in ${RULES.maxGuesses} takes?`;
}

export function ShareLink({ url }: { url: string }) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState('');
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    // Feature detection must run on the client after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setStatus('Link copied.');
    } catch {
      const el = inputRef.current;
      if (el) {
        el.focus();
        el.select();
        const ok = typeof document.execCommand === 'function' && document.execCommand('copy');
        setStatus(ok ? 'Link copied.' : 'Select the link and copy it.');
      }
    }
  };

  const share = async () => {
    try {
      await navigator.share({ title: APP_NAME, text: pitchShareText(), url });
      setStatus('Shared.');
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') setStatus('Sharing did not work. Copy the link instead.');
    }
  };

  return (
    <div>
      <label htmlFor={id} className="mb-2 block font-semibold">
        Challenge link
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          ref={inputRef}
          id={id}
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded-[var(--radius)] border border-ink bg-bg px-3 py-3 font-mono text-sm text-ink"
        />
        <div className="flex gap-2">
          <Button variant="solid" onClick={copy}>
            Copy link
          </Button>
          {canShare ? (
            <Button variant="outline" onClick={share}>
              Share
            </Button>
          ) : null}
        </div>
      </div>
      <p className="mt-2 min-h-5 font-mono text-sm text-ink-dim" role="status" aria-live="polite">
        {status}
      </p>
    </div>
  );
}
