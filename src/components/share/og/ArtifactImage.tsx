// The share card for /api/share/card (design brief v2, principle 8): a spoiler-free result card
// in two formats, portrait 1080x1350 (feeds, stories) and wide 1200x630 (link previews, X).
// Input is a validated ArtifactCard: mode, reel, date, outcome, stat, caption, verdict grid.
// Never a title, poster or answer.
//
// Satori notes: flexbox only, every element with more than one child needs display:flex, no CSS
// variables, and no emoji or unusual glyphs (a missing glyph makes next/og fetch a fallback font
// over the network). Marks and icons are drawn as inline SVG. The bundled default face is the
// only font; the condensed display look comes from a same-color text stroke (weight) and a
// horizontal scale (width).
import type { CSSProperties, ReactNode } from 'react';
import { APP_NAME, COPY, shareHost } from '@/config/brand';
import type { ArtifactCell, ArtifactMode } from '../artifact';
import type { ArtifactCard, ArtifactFormat } from '../artifactCodec';
import { ARTIFACT_FORMATS } from '../artifactCodec';
import { ARTIFACT_MODE_STYLE, formatArtifactDate } from '../artifactModes';
import { OG } from './ogTheme';

const SLATE = '#121110';
const CHALK = '#f3efe6';
const CHALK_DIM = '#a8a196';
const MISS_TILE = '#9c9383'; // darker warm gray: clearly a miss on paper, unlike the outlined empty cell
const MISS_EDGE = '#7c7365';
const EMPTY_RULE = '#b9b0a0';

// ---------------------------------------------------------------------------
// Display type: condensed bold from the default face.
// ---------------------------------------------------------------------------

const SCALE_X = 0.74;
/** Rough advance widths of the default face, in ems, before the horizontal scale. */
function emWidth(text: string): number {
  let w = 0;
  for (const ch of text) {
    if (ch === ' ') w += 0.28;
    else if (ch === '/' || ch === '.' || ch === '1' || ch === 'I') w += 0.42;
    else if (ch === '+' || ch === '-') w += 0.55;
    else if (ch === 'M' || ch === 'W') w += 0.86;
    else w += 0.64;
  }
  return w;
}

/** Largest font size (<= max) at which the condensed text fits `width` px. */
export function fitFontSize(text: string, width: number, max: number): number {
  const em = Math.max(emWidth(text), 0.5);
  return Math.floor(Math.min(max, width / (em * SCALE_X)));
}

function Display({
  children,
  size,
  color,
  weight = 0.05,
  tracking = -0.035,
  align = 'center',
  style,
}: {
  children: string;
  size: number;
  color: string;
  /** Stroke width as a fraction of the font size. */
  weight?: number;
  tracking?: number;
  align?: 'center' | 'left';
  style?: CSSProperties;
}) {
  return (
    <div style={{ display: 'flex', width: '100%', justifyContent: align === 'center' ? 'center' : 'flex-start', ...style }}>
      <div
        style={{
          display: 'flex',
          flexShrink: 0,
          whiteSpace: 'nowrap',
          fontSize: size,
          lineHeight: 1,
          color,
          letterSpacing: size * tracking,
          WebkitTextStroke: `${Math.max(1, size * weight)}px ${color}`,
          transform: `scaleX(${SCALE_X})`,
          transformOrigin: align === 'center' ? 'center' : 'left',
        }}
      >
        {children}
      </div>
    </div>
  );
}

const label = (size: number, color: string): CSSProperties => ({
  fontSize: size,
  letterSpacing: size * 0.22,
  textTransform: 'uppercase',
  color,
  lineHeight: 1,
});

// ---------------------------------------------------------------------------
// Marks and icons (inline SVG, 24 unit grid).
// ---------------------------------------------------------------------------

function Svg({ size, children, color, stroke = 2 }: { size: number; children: ReactNode; color: string; stroke?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

const ICONS: Record<ArtifactMode, ReactNode> = {
  // Clapperboard.
  daily: (
    <g>
      <path d="M3.5 10h17v9.5a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z" />
      <path d="M3.2 9.6 2.6 6a1 1 0 0 1 .8-1.1l15.4-2.6a1 1 0 0 1 1.1.8l.5 2.9z" />
      <path d="M7.4 4.3l2.4 4.1M12.3 3.5l2.4 4.1" />
    </g>
  ),
  // Film reel.
  vault: (
    <g>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="12" cy="6.8" r="1.9" />
      <circle cx="12" cy="17.2" r="1.9" />
      <circle cx="6.8" cy="12" r="1.9" />
      <circle cx="17.2" cy="12" r="1.9" />
    </g>
  ),
  // Paper plane: a film pitched to a friend.
  pitch: (
    <g>
      <path d="M21 3 3.5 10.2l6.8 2.9L21 3z" />
      <path d="M21 3l-7.6 17.5-3.1-7.4" />
    </g>
  ),
  // Film strip loop.
  unlimited: (
    <g>
      <path d="M6.5 8.5c-2 0-3.5 1.6-3.5 3.5s1.5 3.5 3.5 3.5c3.5 0 7.5-7 11-7 2 0 3.5 1.6 3.5 3.5s-1.5 3.5-3.5 3.5c-3.5 0-7.5-7-11-7z" />
    </g>
  ),
  // Ticket stub.
  opening_weekend: (
    <g>
      <path d="M3 7.5a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1V10a2 2 0 0 0 0 4v2.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V14a2 2 0 0 0 0-4z" />
      <path d="M14.5 6.5v11" strokeDasharray="1.6 2" />
    </g>
  ),
  // Ascending bars: sorted by release.
  release_order: (
    <g>
      <path d="M5 20v-5M10 20v-8M15 20v-11M20 20V4" />
    </g>
  ),
  // Two linked rings: a chain of shared films.
  casting_call: (
    <g>
      <circle cx="8.5" cy="12" r="5" />
      <circle cx="15.5" cy="12" r="5" />
    </g>
  ),
  // Quote marks on a page.
  logline: (
    <g>
      <path d="M5 4.5h10l4 4V20a.5.5 0 0 1-.5.5h-13A.5.5 0 0 1 5 20z" />
      <path d="M8.5 11.5h7M8.5 14.5h7M8.5 17.5h4.5" />
    </g>
  ),
};

function Check({ size, color }: { size: number; color: string }) {
  return (
    <Svg size={size} color={color} stroke={3.4}>
      <path d="M5.2 12.6l4.4 4.4 9.2-9.6" />
    </Svg>
  );
}

function Approx({ size, color }: { size: number; color: string }) {
  return (
    <Svg size={size} color={color} stroke={3}>
      <path d="M4.5 9.6c2.5-2.4 5-2.4 7.5 0s5 2.4 7.5 0" />
      <path d="M4.5 15.6c2.5-2.4 5-2.4 7.5 0s5 2.4 7.5 0" />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

/** Clapper stick: skewed chalk and slate bars. */
function ClapperStick({ width, height }: { width: number; height: number }) {
  const bar = Math.round(height * 1.35);
  const count = Math.ceil(width / bar) + 3;
  return (
    <div style={{ display: 'flex', width, height, overflow: 'hidden', background: SLATE, borderRadius: `${height * 0.28}px ${height * 0.28}px 0 0` }}>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          style={{
            width: bar,
            height,
            flexShrink: 0,
            marginLeft: i === 0 ? -bar : 0,
            background: i % 2 === 0 ? CHALK : SLATE,
            transform: 'skewX(-38deg)',
          }}
        />
      ))}
    </div>
  );
}

function ModePill({ mode, scale }: { mode: ArtifactMode; scale: number }) {
  const s = ARTIFACT_MODE_STYLE[mode];
  const h = 64 * scale;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height: h,
        padding: `0 ${26 * scale}px 0 ${16 * scale}px`,
        borderRadius: h / 2,
        background: s.accent,
        gap: 12 * scale,
      }}
    >
      <Svg size={38 * scale} color={s.onAccent} stroke={2}>
        {ICONS[mode]}
      </Svg>
      <div style={{ display: 'flex', ...label(24 * scale, s.onAccent), letterSpacing: 24 * scale * 0.16 }}>{s.label}</div>
    </div>
  );
}

interface SlateField {
  k: string;
  v: string;
}

function slateFields(card: ArtifactCard): SlateField[] {
  const fields: SlateField[] = [];
  if (card.reelNumber !== null) fields.push({ k: 'Reel', v: `No. ${String(card.reelNumber).padStart(3, '0')}` });
  if (card.date) fields.push({ k: 'Date', v: formatArtifactDate(card.date) });
  if (card.mode === 'pitch') fields.push({ k: 'From', v: 'A friend' });
  if (card.mode === 'unlimited') fields.push({ k: 'Reel', v: 'Practice' });
  if (card.hinted) fields.push({ k: 'Notes', v: 'Used' });
  else if (ARTIFACT_MODE_STYLE[card.mode].stamp) fields.push({ k: 'Notes', v: 'None' });
  return fields.slice(0, 3);
}

function Field({ f, scale, first }: { f: SlateField; scale: number; first: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        gap: 10 * scale,
        paddingLeft: first ? 0 : 24 * scale,
        borderLeft: first ? 'none' : `2px solid rgba(243,239,230,0.22)`,
      }}
    >
      <div style={{ display: 'flex', ...label(17 * scale, CHALK_DIM) }}>{f.k}</div>
      <div style={{ display: 'flex', fontSize: 34 * scale, color: CHALK, lineHeight: 1, letterSpacing: 0.5, WebkitTextStroke: `${0.8 * scale}px ${CHALK}` }}>
        {f.v}
      </div>
    </div>
  );
}

function Stamp({ won, scale }: { won: boolean; scale: number }) {
  const color = won ? OG.greenDeep : OG.red;
  const lines = won ? [COPY.winStamp] : COPY.lossStamp.split(' ').reduce<string[]>((acc, w, i) => {
    // "SENT TO" / "TURNAROUND"
    if (i < 2) acc[0] = acc[0] ? `${acc[0]} ${w}` : w;
    else acc[1] = acc[1] ? `${acc[1]} ${w}` : w;
    return acc;
  }, []);
  const size = (won ? 58 : 40) * scale;
  return (
    <div
      style={{
        display: 'flex',
        padding: 6 * scale,
        border: `${5 * scale}px solid ${color}`,
        borderRadius: 10 * scale,
        transform: 'rotate(-8deg)',
        opacity: 0.92,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: `${10 * scale}px ${22 * scale}px`,
          border: `${2 * scale}px solid ${color}`,
          borderRadius: 5 * scale,
        }}
      >
        {lines.map((l) => (
          <div
            key={l}
            style={{
              display: 'flex',
              fontSize: size,
              lineHeight: 1.05,
              letterSpacing: size * 0.08,
              color,
              WebkitTextStroke: `${size * 0.045}px ${color}`,
            }}
          >
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}

function Cell({ cell, size }: { cell: ArtifactCell; size: number }) {
  const radius = Math.round(size * 0.2);
  if (cell === 'empty') {
    return <div style={{ display: 'flex', width: size, height: size, borderRadius: radius, border: `${Math.max(2, size * 0.055)}px solid ${EMPTY_RULE}` }} />;
  }
  const bg = cell === 'match' ? OG.green : cell === 'close' ? OG.amber : MISS_TILE;
  return (
    <div style={{ display: 'flex', width: size, height: size, borderRadius: radius, alignItems: 'center', justifyContent: 'center', background: bg, ...(cell === 'miss' ? { border: `${Math.max(2, size * 0.04)}px solid ${MISS_EDGE}` } : {}) }}>
      {cell === 'match' ? <Check size={size * 0.74} color={OG.greenInk} /> : null}
      {cell === 'close' ? <Approx size={size * 0.7} color={OG.amberInk} /> : null}
    </div>
  );
}

/** Cell size and gap that fit `rows` x `cols` in a box. */
function gridMetrics(rows: number, cols: number, maxW: number, maxH: number, maxCell: number) {
  const ratio = 0.16; // gap as a fraction of the cell
  const byW = maxW / (cols + (cols - 1) * ratio);
  const byH = maxH / (rows + (rows - 1) * ratio);
  const cell = Math.floor(Math.min(byW, byH, maxCell));
  return { cell, gap: Math.max(4, Math.round(cell * ratio)) };
}

function Grid({ grid, maxW, maxH, maxCell }: { grid: ArtifactCell[][]; maxW: number; maxH: number; maxCell: number }) {
  const cols = Math.max(...grid.map((r) => r.length));
  const { cell, gap } = gridMetrics(grid.length, cols, maxW, maxH, maxCell);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap, alignItems: 'center' }}>
      {grid.map((row, i) => (
        <div key={i} style={{ display: 'flex', gap }}>
          {row.map((c, j) => (
            <Cell key={j} cell={c} size={cell} />
          ))}
        </div>
      ))}
    </div>
  );
}

function Wordmark({ scale, color }: { scale: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 * scale }}>
      <Svg size={34 * scale} color={color} stroke={2.2}>
        {ICONS.daily}
      </Svg>
      <div
        style={{
          display: 'flex',
          fontSize: 40 * scale,
          lineHeight: 1,
          letterSpacing: 40 * scale * 0.02,
          color,
          WebkitTextStroke: `${40 * scale * 0.05}px ${color}`,
          transform: `scaleX(${SCALE_X + 0.06})`,
          transformOrigin: 'left',
          textTransform: 'uppercase',
        }}
      >
        {APP_NAME}
      </div>
    </div>
  );
}

function Background({ card, grainSrc, width, height }: { card: ArtifactCard; grainSrc: string | null; width: number; height: number }) {
  const paper = ARTIFACT_MODE_STYLE[card.mode].paper;
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width, height, display: 'flex', background: paper }}>
      {grainSrc ? (
        // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
        <img src={grainSrc} width={width} height={height} style={{ position: 'absolute', top: 0, left: 0, width, height, opacity: 0.06 }} />
      ) : null}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width,
          height,
          backgroundImage: 'radial-gradient(ellipse at 50% 40%, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 60%, rgba(110,80,30,0.1) 100%)',
        }}
      />
    </div>
  );
}

/** The caption, unless it only repeats the stamp (a loss captioned "sent to turnaround"). */
function captionText(card: ArtifactCard, stamped: boolean): string {
  const c = card.statCaption;
  if (stamped && card.outcome === 'lost' && c.toUpperCase() === COPY.lossStamp) return '';
  if (stamped && card.outcome === 'won' && c.toUpperCase() === COPY.winStamp) return '';
  return c;
}

function Caption({ text, size, accent, align }: { text: string; size: number; accent: string; align: 'center' | 'left' }) {
  const bar = <div style={{ display: 'flex', width: size * 1.3, height: Math.max(4, size * 0.16), borderRadius: 3, background: accent }} />;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: size * 0.45, justifyContent: align === 'center' ? 'center' : 'flex-start' }}>
      {bar}
      <div style={{ display: 'flex', ...label(size, OG.inkDim), WebkitTextStroke: `${size * 0.018}px ${OG.inkDim}` }}>{text}</div>
      {align === 'center' ? bar : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Formats
// ---------------------------------------------------------------------------

/** Display line box as a fraction of the font size (tight: the face has generous ascenders). */
const STAT_LINE = 0.84;

function Portrait({ card, grainSrc }: { card: ArtifactCard; grainSrc: string | null }) {
  const { width, height } = ARTIFACT_FORMATS.portrait;
  const pad = 72;
  const inner = width - pad * 2;
  const style = ARTIFACT_MODE_STYLE[card.mode];
  const stamped = style.stamp && card.outcome !== 'score';
  const rows = card.grid.length;
  const hasGrid = rows > 0;
  const stat = card.stat.toUpperCase();
  const caption = captionText(card, stamped);
  const fields = slateFields(card);

  // Vertical budget between the slate and the footer.
  const slateH = pad - 8 + 62 + 56 + (fields.length ? 218 : 124);
  const footerH = 122;
  const body = height - slateH - footerH;
  const statMax = !hasGrid ? 400 : rows <= 3 ? 340 : rows <= 6 ? 290 : 210;
  const statSize = fitFontSize(stat, stamped ? inner * 0.6 : inner * 0.94, statMax);
  const captionSize = 36;
  const statBlockH = statSize * STAT_LINE + (caption ? captionSize + 34 : 0);
  const gridTop = rows <= 3 ? 76 : 50;
  const gridMaxH = body - gridTop - statBlockH - (rows > 6 ? 130 : 110);

  return (
    <div style={{ width, height, display: 'flex', flexDirection: 'column', position: 'relative', color: OG.ink }}>
      <Background card={card} grainSrc={grainSrc} width={width} height={height} />

      {/* Slate */}
      <div style={{ display: 'flex', flexDirection: 'column', padding: `${pad - 8}px ${pad}px 0`, position: 'relative' }}>
        <div style={{ display: 'flex', transform: 'rotate(-3deg)', transformOrigin: 'left bottom', marginBottom: 6 }}>
          <ClapperStick width={inner} height={56} />
        </div>
        <ClapperStick width={inner} height={56} />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            background: SLATE,
            padding: '30px 36px 34px',
            gap: 30,
            borderRadius: '0 0 18px 18px',
            boxShadow: '0 22px 40px -24px rgba(60,40,10,0.55)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <ModePill mode={card.mode} scale={1} />
            <div style={{ display: 'flex', ...label(17, CHALK_DIM) }}>{`Rev. ${style.revision}`}</div>
          </div>
          {fields.length ? (
            <div style={{ display: 'flex' }}>
              {fields.map((f, i) => (
                <Field key={f.k + i} f={f} scale={1} first={i === 0} />
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* Body: stat (and stamp), then the grid */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', padding: `0 ${pad}px` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: stamped ? 'space-between' : 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: stamped ? 'flex-start' : 'center', gap: 34 }}>
            <Display size={statSize} color={OG.ink} weight={0.055} align={stamped ? 'left' : 'center'} style={{ height: statSize * STAT_LINE, alignItems: 'center' }}>
              {stat}
            </Display>
            {caption ? <Caption text={caption} size={captionSize} accent={style.accentDeep} align={stamped ? 'left' : 'center'} /> : null}
          </div>
          {stamped ? (
            <div style={{ display: 'flex', marginRight: 8 }}>
              <Stamp won={card.outcome === 'won'} scale={card.outcome === 'won' ? 0.86 : 0.8} />
            </div>
          ) : null}
        </div>
        {hasGrid ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: gridTop }}>
            <Grid grid={card.grid} maxW={inner} maxH={gridMaxH} maxCell={92} />
          </div>
        ) : null}
      </div>

      {/* Footer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          margin: `0 ${pad}px`,
          height: footerH,
          paddingBottom: 26,
          borderTop: `2px solid ${OG.ink}`,
        }}
      >
        <Wordmark scale={1} color={OG.ink} />
        <div style={{ display: 'flex', ...label(24, OG.inkDim), letterSpacing: 2 }}>{shareHost()}</div>
      </div>
    </div>
  );
}

function Wide({ card, grainSrc }: { card: ArtifactCard; grainSrc: string | null }) {
  const { width, height } = ARTIFACT_FORMATS.wide;
  const pad = 52;
  const style = ARTIFACT_MODE_STYLE[card.mode];
  const stamped = style.stamp && card.outcome !== 'score';
  const hasGrid = card.grid.length > 0;
  const stat = card.stat.toUpperCase();
  const caption = captionText(card, stamped);
  const leftW = 520;
  const statSize = hasGrid
    ? fitFontSize(stat, leftW * 0.95, stamped ? 190 : 220)
    : fitFontSize(stat, (width - pad * 2) * (stamped ? 0.5 : 0.9), 250);
  const fields = slateFields(card);
  const s = 0.7;

  return (
    <div style={{ width, height, display: 'flex', flexDirection: 'column', position: 'relative', color: OG.ink }}>
      <Background card={card} grainSrc={grainSrc} width={width} height={height} />
      <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <ClapperStick width={width} height={34} />
        <div style={{ display: 'flex', alignItems: 'center', background: SLATE, padding: `18px ${pad}px`, gap: 32 }}>
          <ModePill mode={card.mode} scale={s} />
          <div style={{ display: 'flex', flex: 1 }}>
            {fields.map((f, i) => (
              <Field key={f.k + i} f={f} scale={0.72} first={false} />
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, padding: `0 ${pad}px`, alignItems: 'center', justifyContent: hasGrid ? 'flex-start' : 'center', gap: hasGrid ? 40 : 64, position: 'relative' }}>
        <div style={{ display: 'flex', flexDirection: 'column', ...(hasGrid ? { width: leftW } : {}), alignItems: hasGrid ? 'flex-start' : 'center', gap: 24 }}>
          <Display size={statSize} color={OG.ink} weight={0.055} align={hasGrid ? 'left' : 'center'} style={{ height: statSize * STAT_LINE, alignItems: 'center' }}>
            {stat}
          </Display>
          {caption ? <Caption text={caption} size={28} accent={style.accentDeep} align={hasGrid ? 'left' : 'center'} /> : null}
          {stamped && hasGrid ? (
            <div style={{ display: 'flex', marginTop: 26, marginLeft: 6 }}>
              <Stamp won={card.outcome === 'won'} scale={0.6} />
            </div>
          ) : null}
        </div>
        {stamped && !hasGrid ? <Stamp won={card.outcome === 'won'} scale={0.8} /> : null}
        {hasGrid ? (
          <div style={{ display: 'flex', flex: 1, justifyContent: 'center' }}>
            <Grid grid={card.grid} maxW={width - pad * 2 - leftW - 40} maxH={height - 34 - 96 - 64 - 44} maxCell={card.grid.length <= 2 ? 84 : 64} />
          </div>
        ) : null}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: `0 ${pad}px`, padding: '14px 0 22px', borderTop: `2px solid ${OG.ink}`, position: 'relative' }}>
        <Wordmark scale={0.7} color={OG.ink} />
        <div style={{ display: 'flex', ...label(18, OG.inkDim), letterSpacing: 1.5 }}>{shareHost()}</div>
      </div>
    </div>
  );
}

export function ArtifactImage({ card, format, grainSrc = null }: { card: ArtifactCard; format: ArtifactFormat; grainSrc?: string | null }) {
  return format === 'wide' ? <Wide card={card} grainSrc={grainSrc} /> : <Portrait card={card} grainSrc={grainSrc} />;
}
