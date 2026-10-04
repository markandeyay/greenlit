'use client';
// Finished round: the verdict, the optimal chain (only ever present in a finished state), and the
// spoiler-free share line.
import { useMemo, type RefObject } from 'react';
import { COPY } from '@/config/brand';
import { Button, buttonClass } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { StatusGlyph } from '@/components/ui/StatusGlyph';
import { useToast } from '@/components/ui/Toast';
import { VisuallyHidden } from '@/components/ui/VisuallyHidden';
import { cx } from '@/components/ui/cx';
import { canUseNativeShare, copyText, nativeShare, xIntentUrl } from '@/components/share/shareActions';
import { plural } from '@/lib/format';
import type { CastingCallState } from '@/server/modes/casting-call/types';
import { CastingBoard } from './CastingBoard';
import { castingShareHeader, castingShareText, castingShareUrl } from './shareText';

export function CastingResult({ state, headingRef }: { state: CastingCallState; headingRef?: RefObject<HTMLHeadingElement | null> }) {
  const { toast } = useToast();
  const result = state.result!;
  const won = state.status === 'won';
  const films = state.chain.length;
  const optimal = result.optimalFilms;

  const share = useMemo(() => {
    const input = { date: state.date, status: won ? ('won' as const) : ('lost' as const), films, optimal };
    return { text: castingShareText(input), header: castingShareHeader(input), url: castingShareUrl() };
  }, [state.date, won, films, optimal]);

  const copy = async () => {
    const ok = await copyText(share.text);
    toast(ok ? 'Copied' : 'Could not copy. Select the preview text and copy it.');
  };
  const post = async () => {
    if (canUseNativeShare()) {
      const r = await nativeShare({ text: share.header, url: share.url });
      if (r !== 'failed') return;
    }
    await copy();
  };

  const verdict = won
    ? films === optimal
      ? 'A perfect chain. You matched the optimal path.'
      : `You connected them in ${plural(films, 'film')}.`
    : films >= state.maxLinks
      ? `Out of links after ${plural(films, 'film')}.`
      : 'You walked away from this one.';

  return (
    <section aria-labelledby="cc-result" className="flex flex-col gap-6" data-testid="cc-result" data-status={state.status}>
      <div
        className={cx('rounded-[var(--radius)] border border-rule p-5', won && 'gl-status')}
        data-verdict={won ? 'match' : undefined}
      >
        <p data-testid="cc-stamp" className="ty-display anim-stamp text-[length:var(--t-d2)] leading-none">
          {won ? (
            <span className="inline-flex items-center gap-3">
              <StatusGlyph verdict="match" /> {COPY.winStamp}
            </span>
          ) : (
            COPY.lossStamp
          )}
        </p>
        <h2 id="cc-result" ref={headingRef} tabIndex={-1} className="mt-3 text-lg font-semibold outline-none">
          {verdict}
        </h2>
        <p className="ty-label mt-2" data-testid="cc-optimal">
          {won ? `Your chain: ${plural(films, 'film')} · ` : ''}Optimal: {plural(optimal, 'film')}
        </p>
      </div>

      <Panel variant="sheet" aria-label="Optimal chain" head={<span>Optimal chain · {plural(optimal, 'film')}</span>}>
        <CastingBoard
          label={`An optimal chain from ${state.start.name} to ${state.end.name}`}
          start={state.start}
          end={state.end}
          chain={result.optimalPath}
          showWanted={false}
        />
      </Panel>

      <Panel variant="raised" head={<h2 className="ty-label m-0">Post your take</h2>}>
        <pre
          data-testid="cc-share-preview"
          aria-hidden="true"
          className="m-0 overflow-x-auto whitespace-pre-wrap break-words rounded-[var(--radius)] border border-rule bg-bg p-3 font-mono text-sm text-ink"
        >
          {share.text}
        </pre>
        <VisuallyHidden>{share.text}</VisuallyHidden>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <Button variant="slate" onClick={post} className="sm:col-span-3">
            Post your take
          </Button>
          <Button onClick={copy}>Copy</Button>
          <a href={xIntentUrl(share.text)} target="_blank" rel="noopener noreferrer" className={cx(buttonClass('outline', 'md', true), 'sm:col-span-2')}>
            <span>Post to X</span>
            <VisuallyHidden> (opens in a new tab)</VisuallyHidden>
          </a>
        </div>
      </Panel>
    </section>
  );
}
