// Shared look for ImageResponse (Satori) images. Satori cannot read CSS variables, so the values
// mirror src/styles/tokens.css. Satori only supports flexbox and needs display:flex on any element
// with more than one child. No emoji or unusual glyphs: a missing glyph would make next/og fetch
// a fallback font over the network, so checks and close marks are drawn with boxes.
import type { CSSProperties } from 'react';

export const OG_SIZE = { width: 1200, height: 630 } as const;

export const OG = {
  bg: '#f5f2eb', // script paper
  surface: '#fbf9f4',
  surface2: '#efe9dc',
  ink: '#1a1714',
  inkDim: '#4a4640',
  rule: '#d9d3c7',
  green: '#3dbe78',
  greenInk: '#06210f',
  greenDeep: '#17733f', // the match color at text size
  amber: '#f2c14e', // marker yellow
  amberInk: '#2a1a00',
  miss: '#e2dccf',
  red: '#c4211b',
  navy: '#13294b',
  onNavy: '#f2f5f8',
  carolina: '#4b9cd3',
  section: '#0e0d0c', // projector black, for the clapper stripes only
  onSection: '#f5f2eb',
} as const;

/** Slate clapper stripes: skewed paper and projector-black bars (the one ink band). */
export function OgStripes({ height = 44, count = 28 }: { height?: number; count?: number }) {
  const bars = Array.from({ length: count }, (_, i) => i);
  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        height,
        overflow: 'hidden',
        background: OG.section,
        borderBottom: `3px solid ${OG.section}`,
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
            background: i % 2 === 0 ? OG.onSection : OG.section,
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
