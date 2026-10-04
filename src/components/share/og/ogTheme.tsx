// Shared look for ImageResponse (Satori) images. Satori cannot read CSS variables, so the values
// mirror src/styles/tokens.css. Satori only supports flexbox and needs display:flex on any element
// with more than one child. No emoji or unusual glyphs: a missing glyph would make next/og fetch
// a fallback font over the network, so checks and close marks are drawn with boxes.
import type { CSSProperties } from 'react';

export const OG_SIZE = { width: 1200, height: 630 } as const;

export const OG = {
  bg: '#0e0d0c',
  surface: '#171513',
  surface2: '#221f1c',
  ink: '#f5f2eb',
  inkDim: '#a8a196',
  rule: '#36332f',
  green: '#2fbf71',
  greenInk: '#06210f',
  amber: '#e8a93a',
  amberInk: '#2a1a00',
  miss: '#3a3633',
  red: '#f04a42',
} as const;

/** Slate clapper stripes: skewed cream and black bars. */
export function OgStripes({ height = 44, count = 28 }: { height?: number; count?: number }) {
  const bars = Array.from({ length: count }, (_, i) => i);
  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        height,
        overflow: 'hidden',
        background: OG.bg,
        borderBottom: `3px solid ${OG.ink}`,
      }}
    >
      {bars.map((i) => (
        <div
          key={i}
          style={{
            width: 60,
            height,
            flexShrink: 0,
            marginLeft: i === 0 ? -20 : 0,
            background: i % 2 === 0 ? OG.ink : OG.bg,
            transform: 'skewX(-35deg)',
          }}
        />
      ))}
    </div>
  );
}

export const monoLabel: CSSProperties = {
  fontSize: 20,
  letterSpacing: 4,
  textTransform: 'uppercase',
  color: OG.inkDim,
};
