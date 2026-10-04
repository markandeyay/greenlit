'use client';
// ShareArtifactPanel (design brief v2, principle 8): the result card IS what gets shared. Shows
// the actual card PNG from /api/share/card (portrait), a Text tab with the emoji share text, and
// the share actions. Mobile: Web Share API with the PNG file when navigator.canShare({ files })
// allows it, plus text and url. Desktop or unsupported: copy the text and offer the download.
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { APP_NAME } from '@/config/brand';
import { Button, buttonClass, cx, useToast, VisuallyHidden } from '@/components/ui';
import type { ShareArtifactPanelProps } from './artifact';
import { artifactImageUrl, toCard } from './artifactCodec';
import { ARTIFACT_MODE_STYLE, describeArtifact } from './artifactModes';
import { canUseNativeShare, copyText, downloadImage, xIntentUrl } from './shareActions';

type Tab = 'card' | 'text';
type ImageState = 'loading' | 'ready' | 'error';

/** The share text without its trailing link line (navigator.share passes the url separately). */
export function shareBodyFromText(text: string, url: string): string {
  const lines = text.replace(/\s+$/, '').split('\n');
  const last = lines[lines.length - 1]?.trim() ?? '';
  const bare = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (lines.length > 1 && last && (last === url || last === bare || last.replace(/\/$/, '') === bare)) {
    return lines.slice(0, -1).join('\n');
  }
  return lines.join('\n');
}

/** File name for the downloaded or shared card, e.g. "greenlit-the-daily-reel-212.png". */
export function artifactFileName(artifact: Pick<ShareArtifactPanelProps['artifact'], 'mode' | 'reelNumber' | 'date'>): string {
  const where = artifact.reelNumber !== null ? `reel ${artifact.reelNumber}` : (artifact.date ?? '');
  const raw = `${APP_NAME} ${ARTIFACT_MODE_STYLE[artifact.mode].label} ${where}`;
  return `${raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.png`;
}

async function fetchCardFile(src: string, name: string): Promise<File> {
  const res = await fetch(src);
  if (!res.ok) throw new Error(`Card request failed (${res.status})`);
  const blob = await res.blob();
  return new File([blob], name, { type: 'image/png' });
}

function canShareFile(file: File | null): file is File {
  if (!file || typeof navigator === 'undefined' || typeof navigator.canShare !== 'function') return false;
  try {
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

export function ShareArtifactPanel({
  artifact,
  className,
  heading = 'Post your take',
  description,
}: ShareArtifactPanelProps) {
  const { toast } = useToast();
  const base = useId();
  const [tab, setTab] = useState<Tab>('card');
  const [image, setImage] = useState<ImageState>('loading');
  const [busy, setBusy] = useState<'share' | 'download' | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const fileRef = useRef<{ src: string; file: File } | null>(null);
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ card: null, text: null });

  const { mode, reelNumber, date, outcome, stat, statCaption, grid, hinted, url, text } = artifact;
  const share = useMemo(() => {
    const card = toCard({ mode, reelNumber, date, outcome, stat, statCaption, grid, hinted });
    return {
      src: artifactImageUrl(card, 'portrait'),
      alt: describeArtifact(card),
      body: shareBodyFromText(text, url),
      fileName: artifactFileName(card),
    };
  }, [mode, reelNumber, date, outcome, stat, statCaption, grid, hinted, text, url]);

  // A new card means a new image: back to the skeleton until it loads.
  const [shownSrc, setShownSrc] = useState(share.src);
  if (shownSrc !== share.src) {
    setShownSrc(share.src);
    setImage('loading');
  }

  const prefetchFile = useCallback(async (): Promise<File | null> => {
    if (fileRef.current?.src === share.src) return fileRef.current.file;
    try {
      const file = await fetchCardFile(share.src, share.fileName);
      fileRef.current = { src: share.src, file };
      return file;
    } catch {
      return null;
    }
  }, [share.src, share.fileName]);

  const onImageLoad = useCallback(() => {
    setImage('ready');
    // Warm the PNG as a File on share-capable devices so the share sheet opens instantly (the
    // request hits the browser cache: the card is immutable).
    if (canUseNativeShare()) void prefetchFile();
  }, [prefetchFile]);

  // The image may finish loading before hydration attaches onLoad.
  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth > 0) onImageLoad();
  }, [onImageLoad, share.src]);

  const copy = async () => {
    const ok = await copyText(text);
    toast(ok ? 'Copied' : 'Could not copy. Open the Text tab and copy it from there.');
  };

  const onShare = async () => {
    if (busy) return;
    if (!canUseNativeShare()) {
      await copy();
      return;
    }
    setBusy('share');
    try {
      const file = fileRef.current?.src === share.src ? fileRef.current.file : await prefetchFile();
      const data: ShareData = canShareFile(file)
        ? { files: [file], text: share.body, url }
        : { text: share.body, url };
      try {
        await navigator.share(data);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        await copy();
      }
    } finally {
      setBusy(null);
    }
  };

  const onDownload = async () => {
    if (busy) return;
    setBusy('download');
    try {
      await downloadImage(share.src, share.fileName);
    } catch {
      toast('Could not download the image. Try again.');
    } finally {
      setBusy(null);
    }
  };

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const next: Tab = e.key === 'Home' ? 'card' : e.key === 'End' ? 'text' : tab === 'card' ? 'text' : 'card';
    setTab(next);
    tabRefs.current[next]?.focus();
  };

  const headingId = `${base}-heading`;
  const descId = `${base}-desc`;
  const tabs: { id: Tab; label: string }[] = [
    { id: 'card', label: 'Card' },
    { id: 'text', label: 'Text' },
  ];

  return (
    <section
      aria-labelledby={headingId}
      className={cx('gl-panel gl-panel--sheet w-full max-w-xl overflow-hidden', className)}
      data-share-artifact={artifact.mode}
      data-share-text={text}
    >
      <div className="gl-panel__head flex-wrap gap-y-2">
        <h2 id={headingId} className="ty-label m-0">
          {heading}
        </h2>
        <div role="tablist" aria-label="Preview" className="ml-auto inline-flex rounded-full border border-[var(--on-navy)] bg-transparent p-0.5">
          {tabs.map((t) => {
            const selected = tab === t.id;
            return (
              <button
                key={t.id}
                ref={(el) => {
                  tabRefs.current[t.id] = el;
                }}
                type="button"
                role="tab"
                id={`${base}-tab-${t.id}`}
                aria-selected={selected}
                aria-controls={`${base}-panel-${t.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setTab(t.id)}
                onKeyDown={onTabKey}
                className={cx(
                  'min-h-11 min-w-16 rounded-full px-4 text-sm font-semibold transition-colors',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                  selected ? 'bg-[var(--on-navy)] text-[var(--navy)]' : 'text-[var(--on-navy)] hover:underline',
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="gl-panel__body flex flex-col gap-4">
        {/* One reserved 4:5 box for both tabs: switching never shifts the actions. */}
        <div className="relative mx-auto aspect-[1080/1350] w-full max-w-[360px]">
          <div
            role="tabpanel"
            id={`${base}-panel-card`}
            aria-labelledby={`${base}-tab-card`}
            hidden={tab !== 'card'}
            className="absolute inset-0"
          >
            {image !== 'ready' ? (
              <div
                aria-hidden="true"
                data-testid="share-card-skeleton"
                className={cx(
                  'absolute inset-0 overflow-hidden rounded-[6px] border border-rule bg-surface-2',
                  image === 'loading' && 'motion-safe:animate-pulse',
                )}
              >
                <div className="h-[30%] w-full bg-ink-section" />
                {image === 'error' ? (
                  <p className="m-0 p-4 text-sm text-ink-dim">Card preview unavailable. The Text tab has your result.</p>
                ) : null}
              </div>
            ) : null}
            {/* eslint-disable-next-line @next/next/no-img-element -- immutable API PNG, not an optimizable asset */}
            <img
              ref={imgRef}
              key={share.src}
              src={share.src}
              alt={share.alt}
              width={1080}
              height={1350}
              decoding="async"
              data-testid="share-card-image"
              onLoad={onImageLoad}
              onError={() => setImage('error')}
              className={cx(
                'absolute inset-0 h-full w-full rounded-[6px] border border-rule object-cover shadow-[var(--shadow-md)] transition-opacity duration-300',
                image === 'ready' ? 'opacity-100' : 'opacity-0',
              )}
            />
          </div>
          <div
            role="tabpanel"
            id={`${base}-panel-text`}
            aria-labelledby={`${base}-tab-text`}
            hidden={tab !== 'text'}
            tabIndex={0}
            className="absolute inset-0 overflow-auto rounded-[6px] border border-rule bg-bg"
          >
            <pre
              data-testid="share-preview"
              className="m-0 whitespace-pre-wrap break-words p-4 font-mono text-sm leading-relaxed text-ink"
            >
              {text}
            </pre>
          </div>
        </div>
        <VisuallyHidden id={descId}>{description ?? share.alt}</VisuallyHidden>

        <Button variant="slate" size="lg" block className="mt-3" onClick={onShare} aria-describedby={descId} aria-busy={busy === 'share' || undefined}>
          Share
        </Button>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Button variant="outline" block onClick={copy}>
            Copy text
          </Button>
          <a href={xIntentUrl(text)} target="_blank" rel="noopener noreferrer" className={buttonClass('outline', 'md', true)}>
            <span>Post to X</span>
            <VisuallyHidden> (opens in a new tab)</VisuallyHidden>
          </a>
          <Button
            variant="outline"
            block
            onClick={onDownload}
            disabled={busy === 'download'}
            aria-busy={busy === 'download' || undefined}
            className="col-span-2 sm:col-span-1"
          >
            {busy === 'download' ? 'Rendering image' : 'Download image'}
          </Button>
        </div>
      </div>
    </section>
  );
}
