// The Vault (Sections 3, 5): every released past daily as a simple list. Public fields only
// (number, date, theme); this device's results are layered on client side.
import type { Metadata } from 'next';
import Link from 'next/link';
import { APP_NAME, COPY } from '@/config/brand';
import { PageHeader } from '@/components/chrome/PageHeader';
import { ButtonLink } from '@/components/ui/Button';
import { Accent } from '@/components/ui/Heading';
import { IconArrow } from '@/components/ui/icons';
import { VaultResultBadge } from '@/components/game/VaultResultBadge';
import { formatShortDate } from '@/lib/format';
import { listVault, todayInfo } from '@/server/puzzles';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'The Vault',
  description: `Every past ${APP_NAME} reel, ready to replay.`,
};

const pad3 = (n: number) => String(n).padStart(3, '0');

export default async function VaultPage() {
  const reels = await listVault();
  const today = todayInfo();
  return (
    <main className="l-page gl-page">
      <PageHeader
        title={
          <>
            The <Accent>Vault</Accent>
          </>
        }
        lede="Replay any past reel. Vault plays are tracked on their own and never count toward the leaderboard."
      />

      {today.number >= 1 ? (
        <div className="gl-callout mt-6">
          <p className="font-semibold">{COPY.reelLabel(today.number)} is showing today</p>
          <ButtonLink href="/" variant="solid" size="sm">
            Play today
          </ButtonLink>
        </div>
      ) : null}

      {reels.length === 0 ? (
        <div className="mt-6 rounded-[var(--radius-lg)] border border-dashed border-rule px-5 py-8 text-center">
          <p className="gl-h2">The shelves are empty</p>
          <p className="mx-auto mt-2 max-w-[44ch] text-ink-dim">
            Nothing has premiered before today yet. Come back tomorrow and today&apos;s reel will be waiting here.
          </p>
        </div>
      ) : (
        <ul className="gl-reels mt-6" aria-label="Past reels">
          {reels.map((r) => (
            <li key={r.number}>
              <Link href={`/vault/${r.number}`} className="gl-reel">
                <span className="gl-reel__can" aria-hidden="true">
                  {pad3(r.number)}
                </span>
                <span className="gl-reel__body">
                  <span className="gl-reel__title">{COPY.reelLabel(r.number)}</span>
                  <span className="gl-reel__sub">
                    <span className="tabular-nums">{formatShortDate(r.date)}</span>
                    {r.theme ? <> · {r.theme}</> : null}
                  </span>
                  <span className="gl-reel__badge">
                    <VaultResultBadge
                      refs={[
                        { kind: 'vault', ref: String(r.number) },
                        { kind: 'daily', ref: String(r.number) },
                      ]}
                    />
                  </span>
                </span>
                <IconArrow className="gl-reel__arrow" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
