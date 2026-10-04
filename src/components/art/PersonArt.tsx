// Headshot fallback: a warm, illustrated-feeling portrait tile. Deterministic ground from the
// name, a studio key-light wedge, a tonal head-and-shoulders silhouette, large initials in display
// type, a faint halftone grain and a thin print border. Pure SVG, no hooks: safe anywhere.
import type { CSSProperties, ReactElement } from 'react';
import { hashString, initials } from '@/lib/format';
import { keyLight, pickPersonPalette, seedOf } from './palette';
import { widthEm } from './title';

export interface PersonArtPerson {
  /** Accepted for convenience; the art is seeded from the name (see palette.ts). */
  id?: number | string;
  name: string;
}

export type PersonArtShape = 'portrait' | 'square';

/**
 * - `color` (default): its own deterministic ground.
 * - `status`: transparent, drawn in currentColor, so a verdict tile's fill (green match, gray
 *   miss) shows through and stays the one color signal.
 */
export type PersonArtTone = 'color' | 'status';

const grainCache = new Map<string, ReactElement[]>();

function grain(w: number, h: number): ReactElement[] {
  const key = `${w}x${h}`;
  const hit = grainCache.get(key);
  if (hit) return hit;
  const dots: ReactElement[] = [];
  const gap = 7;
  for (let row = 0, y = 3; y < h; row++, y += gap * 0.87) {
    for (let x = row % 2 ? 3 + gap / 2 : 3; x < w; x += gap) {
      // Heavier toward the lower left: a printed-photo falloff.
      const k = 0.35 + 0.65 * ((y / h) * 0.65 + (1 - x / w) * 0.35);
      dots.push(<circle key={`${row}-${x}`} cx={Math.round(x * 10) / 10} cy={Math.round(y * 10) / 10} r={Math.round(k * 15) / 10} />);
    }
  }
  grainCache.set(key, dots);
  return dots;
}

export function PersonArt({
  person,
  shape = 'portrait',
  tone = 'color',
  className,
  style,
  label,
}: {
  person: PersonArtPerson;
  shape?: PersonArtShape;
  tone?: PersonArtTone;
  className?: string;
  style?: CSSProperties;
  label?: string;
}) {
  const W = 120;
  const H = shape === 'square' ? 120 : 160;
  const pal = pickPersonPalette(person.name);
  const status = tone === 'status';
  const h = hashString(`pose:${seedOf(person.name)}`);
  // A small seeded pose: head a touch left or right, light from the left or right.
  const lean = ((h % 5) - 2) * 2.5;
  const lightLeft = (h >> 3) % 2 === 0;

  const letters = initials(person.name);
  const square = shape === 'square';
  const headR = square ? 20 : 24;
  const headX = W / 2 + lean;
  const headY = square ? 38 : 52;
  const sTop = headY + headR + (square ? 6 : 9);
  const fs = Math.min(square ? 52 : 58, (W - 20) / widthEm(letters, 0.02));
  const baseline = H - (square ? 13 : 17);
  const wedge = lightLeft
    ? `0,0 ${W * 0.62},0 ${W * 0.18},${H} 0,${H}`
    : `${W * 0.38},0 ${W},0 ${W},${H} ${W * 0.82},${H}`;
  const body = `M${W / 2 - 54} ${H + 2}C${W / 2 - 52} ${sTop + 8} ${W / 2 - 34} ${sTop} ${W / 2} ${sTop}S${W / 2 + 52} ${sTop + 8} ${W / 2 + 54} ${H + 2}Z`;
  const neck = `M${headX - 8} ${headY + headR - 4}h16l3 ${sTop - headY - headR + 6}h-22Z`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      className={className}
      style={{ display: 'block', width: '100%', height: '100%', ...style }}
      data-art="person"
      data-palette={status ? 'status' : pal.name}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true, focusable: 'false' })}
    >
      {status ? null : (
        <>
          <rect width={W} height={H} fill={pal.ground} />
          <polygon points={wedge} fill={keyLight(pal)} />
        </>
      )}
      <g fill={status ? 'currentColor' : pal.tone} opacity={status ? 0.12 : 1}>
        <path d={neck} />
        <circle cx={headX} cy={headY} r={headR} />
        <path d={body} />
      </g>
      <g fill={status ? 'currentColor' : pal.ink} opacity={status ? 0.05 : 0.08}>
        {grain(W, H)}
      </g>
      <rect
        x={4.5}
        y={4.5}
        width={W - 9}
        height={H - 9}
        rx={3}
        fill="none"
        stroke={status ? 'currentColor' : pal.ink}
        strokeOpacity={status ? 0.14 : 0.22}
        strokeWidth={1.5}
      />
      <text
        x={W / 2}
        y={baseline}
        textAnchor="middle"
        fontSize={Math.round(fs * 10) / 10}
        fill={status ? 'currentColor' : pal.ink}
        style={{ fontFamily: 'var(--f-display)', fontWeight: 900 }}
        data-role="initials"
      >
        {letters}
      </text>
    </svg>
  );
}
