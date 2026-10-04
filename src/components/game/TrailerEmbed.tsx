'use client';

import { useState } from 'react';

const YT_ID = /^[A-Za-z0-9_-]{6,20}$/;

/**
 * Trailer with a click-to-load facade: nothing loads from YouTube until the player asks, and
 * then only from youtube-nocookie.com.
 */
export function TrailerEmbed({ youtubeKey, title }: { youtubeKey: string; title: string }) {
  const [loaded, setLoaded] = useState(false);
  if (!YT_ID.test(youtubeKey)) return null;
  const src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtubeKey)}?autoplay=1&rel=0&modestbranding=1`;
  return (
    <div className="gm-trailer">
      {loaded ? (
        <iframe
          src={src}
          title={`${title} trailer`}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <button type="button" className="gm-trailer__play" onClick={() => setLoaded(true)}>
          <span className="grid justify-items-center gap-3">
            <span className="gm-trailer__ring" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="28" height="28">
                <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
              </svg>
            </span>
            <span className="font-mono text-[13px] font-bold tracking-[0.14em] uppercase">
              Roll the trailer
            </span>
            <span className="font-mono text-[11px] text-ink-dim">Loads from YouTube when you press play</span>
          </span>
          <span className="sr-only">: {title}</span>
        </button>
      )}
    </div>
  );
}
