// A designed, deterministic "minimalist one-sheet" for a film: palette, motif and layout picked
// from the title, the title set in Big Shoulders with balanced breaks, the year in Courier.
// Pure SVG, no hooks, no network: safe in server and client components.
//
// Spoiler safety: the art reads only the title and (optionally) the year, and is only rendered
// where that title is already printed. Never pass it a hidden answer.
import type { CSSProperties } from 'react';
import { MotifLayer } from './motifs';
import { pickFilmArt } from './palette';
import { CAP, fitTitle, monogram, splitTitle, upper, widthEm } from './title';

export interface FilmArtFilm {
  /** Accepted for convenience; the art is seeded from the title (see palette.ts). */
  id?: number | string;
  title: string;
  year?: number | null;
}

/** Rendered height (px) below which the poster switches to the compact motif + monogram card. */
export const COMPACT_BELOW = 100;
/** Rendered height (px) below which the kicker, year and subtitle are dropped. */
export const DETAIL_FROM = 180;

const VB_W = 200;
const VB_H = 300;
const MARGIN = 14;

const DISPLAY: CSSProperties = { fontFamily: 'var(--f-display)', fontWeight: 900 };
const MONO: CSSProperties = { fontFamily: 'var(--f-mono)', fontWeight: 700 };

export type FilmArtVariant = 'full' | 'compact';

export function filmArtVariant(size: number): FilmArtVariant {
  return size < COMPACT_BELOW ? 'compact' : 'full';
}

export function FilmArt({
  film,
  size = 300,
  className,
  style,
  label,
}: {
  film: FilmArtFilm;
  /** Rendered HEIGHT in px. Picks the compact card under 100 and drops the small type under 180. */
  size?: number;
  className?: string;
  style?: CSSProperties;
  /** Accessible name; when absent the art is decorative (aria-hidden). */
  label?: string;
}) {
  const pick = pickFilmArt(film.title);
  const { palette: pal, motif, layout, variant } = pick;
  const kind = filmArtVariant(size);
  const detail = size >= DETAIL_FROM;
  const common = {
    viewBox: `0 0 ${VB_W} ${VB_H}`,
    preserveAspectRatio: 'xMidYMid slice',
    className,
    style: { display: 'block', width: '100%', height: '100%', ...style },
    'data-art': 'film',
    'data-variant': kind,
    'data-palette': pal.name,
    'data-motif': motif,
    'data-layout': layout,
    ...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true as const, focusable: 'false' as const }),
  };

  if (kind === 'compact') {
    const mono = monogram(film.title, size >= 60 ? 3 : 2);
    const fs = Math.min(150, (VB_W - 30) / widthEm(mono, 0.02));
    return (
      <svg {...common}>
        <rect width={VB_W} height={VB_H} fill={pal.ground} />
        <MotifLayer motif={motif} x={0} y={0} w={VB_W} h={150} pal={pal} variant={variant} compact />
        <text
          x={VB_W / 2}
          y={150 + (150 + fs * CAP) / 2}
          textAnchor="middle"
          fontSize={fs}
          fill={pal.ink}
          style={DISPLAY}
          data-role="monogram"
        >
          {mono}
        </text>
      </svg>
    );
  }

  const { main, sub } = splitTitle(film.title);
  const subText = detail && sub ? upper(sub) : null;
  const year = detail && film.year ? String(film.year) : null;

  // Boxes per layout (viewBox units).
  const titleW = VB_W - MARGIN * 2;
  let motifBox: { y: number; h: number };
  let titleTop: number;
  let titleH: number;
  let anchor: 'bottom' | 'top';
  if (layout === 'top') {
    titleTop = 34;
    titleH = 78;
    anchor = 'top';
    motifBox = { y: 124, h: 148 };
  } else if (layout === 'stack') {
    titleTop = 178;
    titleH = 104;
    anchor = 'bottom';
    motifBox = { y: 32, h: 138 };
  } else {
    titleTop = 196;
    titleH = 72;
    anchor = 'bottom';
    motifBox = { y: 32, h: 156 };
  }
  if (!detail) {
    // No kicker or year: let the title breathe into the freed space.
    if (layout === 'top') titleTop = 18;
    else titleH += layout === 'stack' ? 12 : 16;
  }

  const subSize = subText ? Math.min(13, titleW / widthEm(subText, 0.08)) : 0;
  const subBlock = subText ? subSize * CAP + 8 : 0;
  const fit = fitTitle(upper(main), {
    width: titleW,
    height: titleH - subBlock,
    maxLines: 4,
    maxSize: layout === 'stack' ? 70 : 60,
    style: layout === 'stack' ? 'stack' : 'uniform',
  });
  const blockH = fit.height + subBlock;
  const y0 = anchor === 'bottom' ? titleTop + titleH - blockH : titleTop;
  const left = layout === 'stack';
  const tx = left ? MARGIN : VB_W / 2;
  const ta = left ? 'start' : 'middle';

  return (
    <svg {...common}>
      <rect width={VB_W} height={VB_H} fill={pal.ground} />
      <MotifLayer motif={motif} x={0} y={motifBox.y} w={VB_W} h={motifBox.h} pal={pal} variant={variant} compact={false} />
      {detail ? (
        <text
          x={left ? MARGIN : VB_W / 2}
          y={22}
          textAnchor={left ? 'start' : 'middle'}
          fontSize={7.5}
          letterSpacing={2.6}
          fill={pal.ink}
          style={MONO}
          data-role="kicker"
        >
          A FILM
        </text>
      ) : null}
      {year && left ? (
        <text x={VB_W - MARGIN} y={22} textAnchor="end" fontSize={7.5} letterSpacing={1.6} fill={pal.ink} style={MONO} data-role="year">
          {year}
        </text>
      ) : null}
      <g fill={pal.ink} style={DISPLAY} data-role="title">
        {fit.lines.map((l, i) => (
          <text
            key={i}
            x={tx}
            y={Math.round((y0 + l.y) * 10) / 10}
            textAnchor={ta}
            fontSize={Math.round(l.size * 10) / 10}
            textLength={Math.round(l.width * 10) / 10}
            lengthAdjust="spacing"
          >
            {l.text}
          </text>
        ))}
      </g>
      {subText ? (
        <text
          x={tx}
          y={Math.round((y0 + fit.height + subBlock) * 10) / 10}
          textAnchor={ta}
          fontSize={Math.round(subSize * 10) / 10}
          letterSpacing={Math.round(subSize * 0.08 * 100) / 100}
          fill={pal.ink}
          style={{ ...DISPLAY, fontWeight: 700 }}
          data-role="subtitle"
        >
          {subText}
        </text>
      ) : null}
      {year && !left ? (
        <text
          x={VB_W / 2}
          y={layout === 'top' ? 290 : 288}
          textAnchor="middle"
          fontSize={9}
          letterSpacing={2.4}
          fill={pal.ink}
          style={MONO}
          data-role="year"
        >
          {year}
        </text>
      ) : null}
    </svg>
  );
}
