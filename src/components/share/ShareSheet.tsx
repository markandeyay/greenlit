'use client';
// ShareSheet (WS6, Sections 6.4, 7, 14; design brief v2 principle 8). Rendered by WS5's
// ResultCard after a play finishes. Builds the classic ShareArtifact (verdicts only, never a
// title, id or poster) and renders the shared ShareArtifactPanel: the card PNG preview, the
// emoji text, and the share actions.
import { useMemo } from 'react';
import { cx } from '@/components/ui';
import { classicArtifact } from './classicArtifact';
import { ShareArtifactPanel } from './ShareArtifactPanel';
import { describeShare } from './shareText';
import type { ShareSheetProps } from './types';

export interface ShareSheetExtraProps {
  /** Heading text. Default "Post your take". */
  heading?: string;
}

export function ShareSheet({ className, heading = 'Post your take', ...input }: ShareSheetProps & ShareSheetExtraProps) {
  const { kind, ref, reelNumber, feedback, status, hintsUsed } = input;
  const { artifact, description } = useMemo(() => {
    const data = { kind, ref, reelNumber, feedback, status, hintsUsed };
    return { artifact: classicArtifact(data), description: describeShare(data) };
  }, [kind, ref, reelNumber, feedback, status, hintsUsed]);

  return (
    <div data-share-sheet="" className={cx('w-full max-w-xl', className)}>
      <ShareArtifactPanel artifact={artifact} heading={heading} description={description} />
    </div>
  );
}
