// Geometric poster motifs. Each one draws inside a nested <svg> viewport (which clips without any
// <defs> or ids, so many posters on one page never collide) in local coordinates 0..w, 0..h.
import type { ReactElement } from 'react';
import { rng, type FilmPalette, type Motif } from './palette';

export interface MotifProps {
  w: number;
  h: number;
  pal: FilmPalette;
  /** Seeded parameters. */
  variant: number;
  /** Fewer elements for thumbnails. */
  compact: boolean;
}

const f = (n: number) => Math.round(n * 10) / 10;

function Sun({ w, h, pal, variant, compact }: MotifProps) {
  const r = rng(variant);
  const R = Math.min(w, h) * (compact ? 0.42 : 0.38);
  const cx = w * (0.38 + r() * 0.24);
  const horizon = h - (compact ? 0 : 14);
  const cy = horizon - R * 0.62;
  const slits = compact ? 2 : 5;
  return (
    <>
      <circle cx={f(cx)} cy={f(cy)} r={f(R)} fill={pal.a} />
      {Array.from({ length: slits }, (_, i) => {
        const y = cy + R * (0.06 + (i / slits) * 0.6);
        const t = (compact ? 5 : 1.6) + i * (compact ? 3 : 1.5);
        return <rect key={i} x={0} y={f(y)} width={w} height={f(t)} fill={pal.ground} />;
      })}
      {compact ? null : (
        <>
          <rect x={0} y={f(horizon)} width={w} height={h} fill={pal.ground} />
          <rect x={0} y={f(horizon)} width={w} height={3} fill={pal.b} />
        </>
      )}
    </>
  );
}

function Stripes({ w, h, pal, variant, compact }: MotifProps) {
  const r = rng(variant);
  const angle = [-32, 32, -58][Math.floor(r() * 3)]!;
  const n = compact ? 5 : 10;
  const span = Math.hypot(w, h) * 1.15;
  const step = span / n;
  return (
    <g transform={`rotate(${angle} ${f(w / 2)} ${f(h / 2)})`}>
      {Array.from({ length: n }, (_, i) => (
        <rect
          key={i}
          x={f(w / 2 - span / 2 + i * step)}
          y={f(h / 2 - span / 2)}
          width={f(step * (i % 2 ? 0.38 : 0.6))}
          height={f(span)}
          fill={i % 3 === 2 ? pal.b : pal.a}
        />
      ))}
    </g>
  );
}

function Filmstrip({ w, h, pal, variant, compact }: MotifProps) {
  const r = rng(variant);
  const angle = r() < 0.5 ? -16 : 16;
  const bw = compact ? h * 0.62 : Math.min(76, h * 0.5);
  const len = Math.hypot(w, h) * 1.3;
  const x0 = w / 2 - len / 2;
  const y0 = h / 2 - bw / 2;
  const perf = compact ? 0 : Math.floor(len / 13);
  const frames = Math.floor(len / (bw * 0.95));
  const fw = bw * 0.7;
  return (
    <g transform={`rotate(${angle} ${f(w / 2)} ${f(h / 2)})`}>
      <rect x={f(x0)} y={f(y0)} width={f(len)} height={f(bw)} fill={pal.b} />
      {Array.from({ length: frames }, (_, i) => (
        <rect
          key={`f${i}`}
          x={f(x0 + i * bw * 0.95 + bw * 0.12)}
          y={f(y0 + bw * 0.18)}
          width={f(fw)}
          height={f(bw * 0.64)}
          rx={2}
          fill={i % 4 === 1 ? pal.ground : pal.a}
        />
      ))}
      {Array.from({ length: perf }, (_, i) => (
        <g key={`p${i}`} fill={pal.ground}>
          <rect x={f(x0 + i * 13 + 3)} y={f(y0 + 3)} width={6} height={5} rx={1} />
          <rect x={f(x0 + i * 13 + 3)} y={f(y0 + bw - 8)} width={6} height={5} rx={1} />
        </g>
      ))}
    </g>
  );
}

function Halftone({ w, h, pal, variant, compact }: MotifProps) {
  const r = rng(variant);
  const gap = compact ? 26 : 9;
  const fx = w * (0.3 + r() * 0.4);
  const fy = h * (0.35 + r() * 0.3);
  const reach = Math.min(w, h) * (compact ? 0.62 : 0.56);
  const maxR = gap * 0.56;
  const dots: ReactElement[] = [];
  for (let row = 0, y = gap / 2; y < h + gap; row++, y += gap * 0.87) {
    for (let x = row % 2 ? gap / 2 : 0; x < w + gap; x += gap) {
      const d = Math.hypot(x - fx, y - fy) / reach;
      const rad = maxR * Math.max(0, 1 - d) ** 0.8;
      if (rad > 0.5) dots.push(<circle key={`${row}-${x}`} cx={f(x)} cy={f(y)} r={f(rad)} />);
    }
  }
  return (
    <>
      <g fill={pal.a}>{dots}</g>
      <circle cx={f(fx)} cy={f(fy)} r={f(reach * 0.16)} fill={pal.b} />
    </>
  );
}

function Arch({ w, h, pal, variant, compact }: MotifProps) {
  const r = rng(variant);
  const aw = compact ? w * 0.6 : w * (0.42 + r() * 0.1);
  const ah = h * (compact ? 0.98 : 0.86);
  const x = (w - aw) / 2;
  const top = h - ah;
  const rad = aw / 2;
  const d = `M${f(x)} ${f(h)}V${f(top + rad)}A${f(rad)} ${f(rad)} 0 0 1 ${f(x + aw)} ${f(top + rad)}V${f(h)}Z`;
  const moon = rad * 0.42;
  return (
    <>
      {compact ? null : <rect x={0} y={f(h - 6)} width={w} height={6} fill={pal.b} />}
      <path d={d} fill={pal.a} />
      <circle cx={f(w / 2)} cy={f(top + rad * 1.05)} r={f(moon)} fill={pal.b} />
    </>
  );
}

function Split({ w, h, pal, variant }: MotifProps) {
  const r = rng(variant);
  const flip = r() < 0.5;
  const pts = flip ? `0,${f(h * 0.12)} ${w},${f(h * 0.88)} ${w},${h} 0,${h}` : `0,${f(h * 0.88)} ${w},${f(h * 0.12)} ${w},${h} 0,${h}`;
  const R = Math.min(w, h) * 0.24;
  return (
    <>
      <polygon points={pts} fill={pal.a} />
      <circle cx={f(flip ? w * 0.66 : w * 0.34)} cy={f(h * 0.4)} r={f(R)} fill={pal.b} />
    </>
  );
}

function Spotlight({ w, h, pal, compact }: MotifProps) {
  const cx = w / 2;
  const base = h - (compact ? 6 : 12);
  const spread = w * 0.4;
  return (
    <>
      <polygon points={`${f(cx - 5)},0 ${f(cx + 5)},0 ${f(cx + spread)},${f(base)} ${f(cx - spread)},${f(base)}`} fill={pal.a} />
      <ellipse cx={f(cx)} cy={f(base)} rx={f(spread)} ry={compact ? 8 : 9} fill={pal.a} />
      <rect x={f(cx - 6)} y={f(base - 30)} width={12} height={30} rx={6} fill={pal.b} />
      <circle cx={f(cx)} cy={f(base - 38)} r={7} fill={pal.b} />
    </>
  );
}

function Rings({ w, h, pal, variant, compact }: MotifProps) {
  const r = rng(variant);
  const cx = r() < 0.5 ? w * 0.18 : w * 0.82;
  const cy = h * (0.25 + r() * 0.5);
  const step = compact ? 26 : 13;
  const max = Math.hypot(w, h);
  const rings: ReactElement[] = [];
  for (let i = 1, rad = step; rad < max; i++, rad += step) {
    rings.push(<circle key={i} cx={f(cx)} cy={f(cy)} r={f(rad)} fill="none" stroke={i % 4 === 0 ? pal.b : pal.a} strokeWidth={f(step * 0.42)} />);
  }
  return (
    <>
      <circle cx={f(cx)} cy={f(cy)} r={f(step * 0.5)} fill={pal.b} />
      {rings}
    </>
  );
}

function Eclipse({ w, h, pal, variant, compact }: MotifProps) {
  const r = rng(variant);
  const R = Math.min(w, h) * 0.36;
  const cx = w * (0.42 + r() * 0.16);
  const cy = h * 0.52;
  const stars = compact ? 0 : 9;
  return (
    <>
      {Array.from({ length: stars }, (_, i) => (
        <circle key={i} cx={f(r() * w)} cy={f(r() * h)} r={f(0.8 + r() * 1.6)} fill={pal.b} />
      ))}
      <circle cx={f(cx)} cy={f(cy)} r={f(R)} fill={pal.a} />
      <circle cx={f(cx + R * 0.38)} cy={f(cy - R * 0.22)} r={f(R * 0.86)} fill={pal.ground} />
      <circle cx={f(cx + R * 0.95)} cy={f(cy + R * 0.7)} r={f(R * 0.12)} fill={pal.b} />
    </>
  );
}

function Waves({ w, h, pal, variant, compact }: MotifProps) {
  const r = rng(variant);
  const n = compact ? 4 : 8;
  const amp = compact ? 10 : 6 + r() * 3;
  const len = compact ? 80 : 40 + r() * 16;
  const sw = compact ? 12 : 5;
  const step = h / n;
  return (
    <g fill="none" strokeWidth={sw} strokeLinecap="round">
      {Array.from({ length: n }, (_, i) => {
        const y = step * (i + 0.5);
        const phase = (i % 2) * (len / 2);
        let d = `M${f(-len + phase)} ${f(y)}`;
        for (let x = -len + phase; x < w + len; x += len) d += `q${f(len / 4)} ${f(-amp)} ${f(len / 2)} 0t${f(len / 2)} 0`;
        return <path key={i} d={d} stroke={i % 3 === 1 ? pal.b : pal.a} />;
      })}
    </g>
  );
}

function Windows({ w, h, pal, variant, compact }: MotifProps) {
  const r = rng(variant);
  const cols = compact ? 3 : 4;
  const rows = compact ? 3 : 5;
  const bw = w * (compact ? 0.74 : 0.6);
  const bx = (w - bw) / 2;
  const top = h * (compact ? 0.08 : 0.06);
  const pad = bw * 0.08;
  const cw = (bw - pad * (cols + 1)) / cols;
  const ch = (h - top - pad * (rows + 1)) / rows;
  const lit = new Set<number>();
  while (lit.size < (compact ? 1 : 3)) lit.add(Math.floor(r() * cols * rows));
  return (
    <>
      <rect x={f(bx)} y={f(top)} width={f(bw)} height={f(h)} fill={pal.a} />
      {Array.from({ length: cols * rows }, (_, i) => (
        <rect
          key={i}
          x={f(bx + pad + (i % cols) * (cw + pad))}
          y={f(top + pad + Math.floor(i / cols) * (ch + pad))}
          width={f(cw)}
          height={f(ch)}
          fill={lit.has(i) ? pal.b : pal.ground}
        />
      ))}
    </>
  );
}

function Peaks({ w, h, pal, variant, compact }: MotifProps) {
  const r = rng(variant);
  const p1 = w * (0.25 + r() * 0.15);
  const p2 = w * (0.62 + r() * 0.15);
  const sunX = r() < 0.5 ? w * 0.24 : w * 0.76;
  return (
    <>
      <circle cx={f(sunX)} cy={f(h * 0.26)} r={f(Math.min(w, h) * (compact ? 0.2 : 0.13))} fill={pal.b} />
      <polygon points={`${f(-20)},${h} ${f(p2)},${f(h * 0.3)} ${f(w + 40)},${h}`} fill={pal.a} />
      <polygon points={`${f(-40)},${h} ${f(p1)},${f(h * 0.5)} ${f(w * 0.85)},${h}`} fill={pal.b} />
    </>
  );
}

const MOTIF_COMPONENTS: Record<Motif, (p: MotifProps) => ReactElement> = {
  sun: Sun,
  stripes: Stripes,
  filmstrip: Filmstrip,
  halftone: Halftone,
  arch: Arch,
  split: Split,
  spotlight: Spotlight,
  rings: Rings,
  eclipse: Eclipse,
  waves: Waves,
  windows: Windows,
  peaks: Peaks,
};

/** One motif clipped to a box of the poster. */
export function MotifLayer({
  motif,
  x,
  y,
  w,
  h,
  ...rest
}: { motif: Motif; x: number; y: number } & MotifProps) {
  const Draw = MOTIF_COMPONENTS[motif];
  return (
    <svg x={x} y={y} width={w} height={h} overflow="hidden" data-motif={motif}>
      <Draw w={w} h={h} {...rest} />
    </svg>
  );
}
