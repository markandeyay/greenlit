'use client';
// The real TMDB image, layered over the designed art. The art underneath is the placeholder while
// the image loads and the fallback when it fails: on error this layer removes itself, so a broken
// image icon never shows.
import { useCallback, useState } from 'react';
import type { CSSProperties } from 'react';

const LAYER: CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
};

export interface ArtImageProps {
  src: string | null;
  alt: string;
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
}

export function ArtImage(props: ArtImageProps) {
  if (!props.src) return null;
  // Keyed by src: a new image gets a fresh error state.
  return <ImageLayer key={props.src} {...props} src={props.src} />;
}

function ImageLayer({ src, alt, width, height, className, priority }: ArtImageProps & { src: string }) {
  const [failed, setFailed] = useState(false);
  // An image that errored before hydration never fires onError for React: check on mount.
  const ref = useCallback((el: HTMLImageElement | null) => {
    if (el && el.complete && el.naturalWidth === 0 && el.getAttribute('src')) setFailed(true);
  }, []);
  if (failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- TMDB CDN, never rehosted (Section 15); the art is the placeholder.
    <img
      ref={ref}
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : undefined}
      onError={() => setFailed(true)}
      className={className}
      style={LAYER}
      data-art-image=""
    />
  );
}
