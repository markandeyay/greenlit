'use client';
import { useState } from 'react';
import { Button, buttonClass } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { canUseNativeShare, copyText, nativeShare, xIntentUrl } from '@/components/share/shareActions';
import type { OwMode } from '@/server/modes/opening-weekend/types';
import { modeUrl, shareLine, shareText } from './share';

/** Copy, native share (touch devices), and Post to X for a run result. */
export function ShareRow({ score, mode, date }: { score: number; mode: OwMode; date: string | null }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const text = shareText(score, mode, date);

  const onShare = async () => {
    if (canUseNativeShare()) {
      const r = await nativeShare({ text: shareLine(score, mode, date), url: modeUrl() });
      if (r !== 'failed') return;
    }
    const ok = await copyText(text);
    setCopied(ok);
    toast(ok ? 'Copied to clipboard' : 'Could not copy. Select the text and copy it.');
  };

  return (
    <div>
      <p className="ty-micro whitespace-pre-line break-words text-ink-dim" data-testid="ow-share-text">
        {text}
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        <Button variant="solid" size="sm" onClick={() => void onShare()} data-testid="ow-share">
          {copied ? '✓ Copied' : 'Share result'}
        </Button>
        <a
          className={buttonClass('ghost', 'sm')}
          href={xIntentUrl(text)}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span>Post to X</span>
        </a>
      </div>
    </div>
  );
}
