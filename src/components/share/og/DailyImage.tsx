// Daily OG image for "/" (Section 7.2): "Reel N" over a blurred, unrecognizable film-grain
// texture. Never a poster or any puzzle data.
import { APP_NAME, APP_TAGLINE } from '@/config/brand';
import { OG, OG_SIZE, OgStripes, monoLabel } from './ogTheme';

export interface DailyImageProps {
  /** Reel number to headline, or null for a generic card (e.g. before launch). */
  reelNumber: number | null;
  /** data: URI of the grain texture (public/og/grain.png), or null to skip it. */
  grainSrc: string | null;
  /** Small kicker above the wordmark. */
  kicker?: string;
}

export function DailyImage({ reelNumber, grainSrc, kicker = "Today's reel" }: DailyImageProps) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        background: OG.bg,
        color: OG.ink,
      }}
    >
      {grainSrc ? (
        // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
        <img
          src={grainSrc}
          width={OG_SIZE.width}
          height={OG_SIZE.height}
          style={{ position: 'absolute', top: 0, left: 0, width: OG_SIZE.width, height: OG_SIZE.height, opacity: 0.07 }}
        />
      ) : null}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: OG_SIZE.width,
          height: OG_SIZE.height,
          backgroundImage: `radial-gradient(ellipse at center, rgba(255,255,255,0.55) 0%, rgba(245,242,235,0) 55%, rgba(120,90,40,0.08) 100%)`,
        }}
      />
      <OgStripes />
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        <div style={{ ...monoLabel, display: 'flex' }}>{kicker}</div>
        <div style={{ display: 'flex', fontSize: 132, lineHeight: 1, letterSpacing: -3, marginTop: 18, textTransform: 'uppercase' }}>
          {APP_NAME}
        </div>
        {reelNumber !== null ? (
          <div
            style={{
              display: 'flex',
              marginTop: 28,
              padding: '10px 28px',
              background: OG.navy,
              color: OG.onNavy,
              borderRadius: 8,
              fontSize: 56,
              letterSpacing: 2,
            }}
          >
            {`Reel ${reelNumber}`}
          </div>
        ) : null}
        <div style={{ display: 'flex', fontSize: 30, color: OG.inkDim, marginTop: 30 }}>{APP_TAGLINE}</div>
      </div>
      <div style={{ ...monoLabel, display: 'flex', justifyContent: 'space-between', padding: '0 56px 28px', position: 'relative', fontSize: 16 }}>
        <span>24 fps</span>
        <span>2.39 : 1</span>
      </div>
    </div>
  );
}
