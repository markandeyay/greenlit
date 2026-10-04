'use client';
// Placeholder (WS0). The share agent replaces this with the real card preview + share actions.
import type { ShareArtifactPanelProps } from './artifact';

export function ShareArtifactPanel({ artifact, className }: ShareArtifactPanelProps) {
  return (
    <div className={className} data-share-artifact={artifact.mode}>
      <pre>{artifact.text}</pre>
    </div>
  );
}
