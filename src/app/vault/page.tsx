// The Vault (Sections 3, 5): every released past daily, as an archive of film cans. Public fields
// only (number, date, theme); this device's results are layered on client side.
import '@/components/game/game.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import { APP_NAME, COPY } from '@/config/brand';
import { Breadcrumb } from '@/components/chrome/Breadcrumb';
import { SlateMeta } from '@/components/chrome/SlateMeta';
import { reelCode } from '@/components/chrome/timecode';
import { ButtonLink } from '@/components/ui/Button';
import { Accent } from '@/components/ui/Heading';
import { VaultResultBadge } from '@/components/game/VaultResultBadge';
import { formatShortDate } from '@/lib/format';
import { listVault, todayInfo } from '@/server/puzzles';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'The Vault',
  description: `Every past ${APP_NAME} reel, ready to replay.`,
};

export default async function VaultPage() {
  const reels = await listVault();
  const today = todayInfo();
  return (
    <main className="l-page gl-page">
      <Breadcrumb items={[{ label: APP_NAME, href: '/' }, { label: 'The Vault' }]} />
      <div className="mt-8">
        <SlateMeta roll={today.date.slice(0, 4)} reel={Math.max(0, today.number)} scene={2} decorative />
        <h1 className="ty-display mt-3 text-[length:var(--t-d1)]">
          The <Accent>Vault</Accent>
        </h1>
        <p className="ty-lede mt-5 text-ink-dim">
          Every reel that has already premiered, kept in the can. Replay any of them. Vault plays are tracked on
          their own and earn no leaderboard credit.
        </p>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-y border-rule py-4">
        <p className="font-mono text-[13px] font-bold tracking-wider uppercase">
          {today.number >= 1 ? `${COPY.reelLabel(today.number)} is showing today` : 'Premiere coming soon'}
        </p>
        <ButtonLink href="/" variant="slate" size="sm">
          Play today&apos;s reel
        </ButtonLink>
      </div>

      {reels.length === 0 ? (
        <div className="mt-10 border border-dashed border-rule px-6 py-10 text-center">
          <p className="ty-display text-3xl">The shelves are empty</p>
          <p className="mx-auto mt-2 max-w-[44ch] text-ink-dim">
            Nothing has premiered before today yet. Come back tomorrow and today&apos;s reel will be waiting here.
          </p>
        </div>
      ) : (
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Past reels">
          {reels.map((r) => (
            <li key={r.number}>
              <Link
                href={`/vault/${r.number}`}
                className="gm-vault-item flex items-center gap-4 border border-rule bg-surface p-4"
              >
                <span className="gm-can" aria-hidden="true">
                  <span className="gm-can__label">{reelCode(r.number)}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="ty-display block text-[26px] leading-none">{COPY.reelLabel(r.number)}</span>
                  <span className="mt-1 block font-mono text-[13px] text-ink-dim tabular-nums">
                    {formatShortDate(r.date)}
                  </span>
                  {r.theme ? <span className="mt-1 block truncate text-[14px] italic">{r.theme}</span> : null}
                  <span className="mt-2 block min-h-[22px]">
                    <VaultResultBadge
                      refs={[
                        { kind: 'vault', ref: String(r.number) },
                        { kind: 'daily', ref: String(r.number) },
                      ]}
                    />
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
