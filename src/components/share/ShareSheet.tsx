'use client';
// ShareSheet (WS6, Sections 6.4, 7, 14). Rendered by WS5's ResultCard after a play finishes.
// Everything here is derived from verdicts only; no title, id or poster ever reaches share output.
import { useId, useMemo, useState } from 'react';
import { APP_NAME } from '@/config/brand';
import { Button, buttonClass, cx, useToast, VisuallyHidden } from '@/components/ui';
import { canUseNativeShare, copyText, downloadImage, nativeShare, xIntentUrl } from './shareActions';
import { gridFromInput, shareImagePath } from './shareGrid';
import { buildShareBody, buildShareText, describeShare, reelLabel, shareUrl, takeLabel } from './shareText';
import type { ShareSheetProps } from './types';

export interface ShareSheetExtraProps {
  /** Heading text. Default "Post your take". */
  heading?: string;
}

/** Slate clapper stripes, cream on black. Decorative only. */
function SlateStripes() {
  return (
    <div
      aria-hidden="true"
      className="h-3 w-full"
      style={{
        backgroundImage:
          'repeating-linear-gradient(-45deg, var(--ink) 0 14px, var(--bg) 14px 28px)',
      }}
    />
  );
}

export function ShareSheet({ className, heading = 'Post your take', ...input }: ShareSheetProps & ShareSheetExtraProps) {
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);
  const headingId = useId();
  const descId = useId();

  const { kind, ref, reelNumber, feedback, status, hintsUsed } = input;
  const share = useMemo(() => {
    const data = { kind, ref, reelNumber, feedback, status, hintsUsed };
    const grid = gridFromInput(data);
    return {
      text: buildShareText(data),
      body: buildShareBody(data),
      url: shareUrl(data),
      image: shareImagePath(data),
      description: describeShare(data),
      reel: reelLabel(grid),
      take: takeLabel(grid),
    };
  }, [kind, ref, reelNumber, feedback, status, hintsUsed]);

  const copy = async () => {
    const ok = await copyText(share.text);
    toast(ok ? 'Copied' : 'Could not copy. Select the preview text and copy it.');
  };

  const onPost = async () => {
    if (canUseNativeShare()) {
      const result = await nativeShare({ text: share.body, url: share.url });
      if (result !== 'failed') return;
    }
    await copy();
  };

  const onDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const name = `${APP_NAME} ${share.reel}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      await downloadImage(share.image, `${name}.png`);
    } catch {
      toast('Could not download the image. Try again.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <section
      aria-labelledby={headingId}
      className={cx('gl-panel gl-panel--sheet w-full max-w-xl overflow-hidden', className)}
      data-share-sheet=""
    >
      <SlateStripes />
      <div className="gl-panel__head flex-wrap">
        <h2 id={headingId} className="ty-label m-0">
          {heading}
        </h2>
        <span className="ty-label tabular-nums" aria-hidden="true">
          {share.reel} · {share.take}
        </span>
      </div>

      <div className="gl-panel__body flex flex-col gap-4">
        <figure className="m-0">
          <figcaption className="ty-micro mb-2 text-ink-dim">Preview</figcaption>
          <pre
            aria-hidden="true"
            data-testid="share-preview"
            className="m-0 overflow-x-auto whitespace-pre-wrap break-words rounded-[3px] border border-rule bg-bg p-3 font-mono text-sm leading-relaxed text-ink"
          >
            {share.text}
          </pre>
          <VisuallyHidden id={descId}>{share.description}</VisuallyHidden>
        </figure>

        <Button variant="slate" size="lg" block onClick={onPost} aria-describedby={descId}>
          Post your take
        </Button>

        <div className="grid gap-2 sm:grid-cols-2">
          <a
            href={xIntentUrl(share.text)}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClass('outline', 'md', true)}
          >
            <span>Post to X</span>
            <VisuallyHidden> (opens in a new tab)</VisuallyHidden>
          </a>
          <Button
            variant="outline"
            block
            onClick={onDownload}
            disabled={downloading}
            aria-busy={downloading || undefined}
          >
            {downloading ? 'Rendering image' : 'Download image'}
          </Button>
        </div>

        <Button variant="ghost" size="sm" onClick={copy} className="self-start">
          Copy text
        </Button>
      </div>
    </section>
  );
}
