// The share image for /api/og/result (Section 7.2): the verdict grid styled as a slate.
// Input is a decoded ShareGrid, which holds verdicts only. Never a title, poster or answer.
import { APP_NAME, COPY, shareHost } from '@/config/brand';
import { RULES } from '@/config/rules';
import type { ShareCell, ShareGrid } from '../shareGrid';
import { OG, OgStripes, monoLabel } from './ogTheme';
import { reelLabel, UNLIMITED_SHARE_PATH } from '../shareText';

const COLUMN_SHORT = ['DIR', 'LEAD', 'SUPP', 'YEAR', 'BOX', 'RTG', 'STU', 'GEN'];
const CELL = 38;
const GAP = 7;

function Check({ color }: { color: string }) {
  return (
    <div
      style={{
        width: 10,
        height: 18,
        marginTop: -4,
        borderRight: `4px solid ${color}`,
        borderBottom: `4px solid ${color}`,
        transform: 'rotate(45deg)',
      }}
    />
  );
}

function Close({ color }: { color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ width: 16, height: 4, background: color, borderRadius: 2 }} />
      <div style={{ width: 16, height: 4, background: color, borderRadius: 2 }} />
    </div>
  );
}

function Cell({ cell }: { cell: ShareCell }) {
  const bg = cell === 'match' ? OG.green : cell === 'close' ? OG.amber : OG.miss;
  return (
    <div
      style={{
        width: CELL,
        height: CELL,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: bg,
        borderRadius: 6,
      }}
    >
      {cell === 'match' ? <Check color={OG.greenInk} /> : cell === 'close' ? <Close color={OG.amberInk} /> : null}
    </div>
  );
}

function Grid({ grid }: { grid: ShareGrid }) {
  const lastWin = grid.status === 'won' ? grid.rows.length - 1 : -1;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
      <div style={{ display: 'flex', gap: GAP, paddingLeft: 58 }}>
        {COLUMN_SHORT.map((c) => (
          <div key={c} style={{ width: CELL, display: 'flex', justifyContent: 'center', fontSize: 12, color: OG.inkDim, letterSpacing: 1 }}>
            {c}
          </div>
        ))}
      </div>
      {grid.rows.map((row, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: GAP }}>
          <div
            style={{
              width: 44,
              marginRight: 7,
              display: 'flex',
              justifyContent: 'flex-end',
              fontSize: 16,
              letterSpacing: 2,
              color: i === lastWin ? OG.greenDeep : OG.inkDim,
            }}
          >
            {`TK${String(i + 1).padStart(2, '0')}`}
          </div>
          {row.map((cell, j) => (
            <Cell key={j} cell={cell} />
          ))}
        </div>
      ))}
      {grid.rows.length === 0 ? (
        <div style={{ display: 'flex', fontSize: 22, color: OG.inkDim, paddingLeft: 58 }}>No takes rolled</div>
      ) : null}
    </div>
  );
}

export function ResultImage({ grid }: { grid: ShareGrid }) {
  const reel = reelLabel(grid);
  const take = grid.status === 'won' ? String(grid.rows.length) : 'X';
  const won = grid.status === 'won';
  const link =
    grid.kind === 'unlimited' ? `${shareHost()}${UNLIMITED_SHARE_PATH}` : grid.kind === 'pitch' ? `${shareHost()}/pitch` : grid.kind === 'vault' ? `${shareHost()}/vault/${grid.reelNumber}` : `${shareHost()}/${grid.reelNumber}`;
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: OG.bg, color: OG.ink }}>
      <OgStripes />
      <div style={{ flex: 1, display: 'flex', padding: '36px 56px 32px', gap: 48 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ ...monoLabel, display: 'flex' }}>Sc 01 · 24 fps · 2.39 : 1</div>
            <div style={{ display: 'flex', fontSize: 92, letterSpacing: -2, lineHeight: 1, marginTop: 14, textTransform: 'uppercase' }}>
              {APP_NAME}
            </div>
            <div style={{ display: 'flex', fontSize: 46, marginTop: 26 }}>{reel}</div>
            <div style={{ display: 'flex', fontSize: 46, color: OG.inkDim }}>{`Take ${take}/${RULES.maxGuesses}`}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div
              style={{
                display: 'flex',
                alignSelf: 'flex-start',
                padding: '8px 18px',
                border: `4px solid ${won ? OG.greenDeep : OG.red}`,
                color: won ? OG.greenDeep : OG.red,
                fontSize: won ? 40 : 30,
                letterSpacing: 4,
                transform: 'rotate(-3deg)',
              }}
            >
              {won ? COPY.winStamp : COPY.lossStamp}
            </div>
            {grid.hintsUsed ? <div style={{ ...monoLabel, display: 'flex', fontSize: 18 }}>With Script Notes</div> : null}
            <div style={{ ...monoLabel, display: 'flex', fontSize: 18 }}>{link}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Grid grid={grid} />
        </div>
      </div>
    </div>
  );
}
