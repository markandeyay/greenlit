'use client';
// /stats body, a Wordle-like sheet. Local stats from this device (readLocalStats + summarize); when signed in, the
// account's server-recorded results are fetched from /api/me and can be merged in.
import { useMemo, useState } from 'react';
import { LOSS_SCORE } from '@/config/game';
import { COPY } from '@/config/brand';
import { RULES } from '@/config/rules';
import { ButtonLink } from '@/components/ui/Button';
import { ToggleChip } from '@/components/ui/Chip';
import { Spinner } from '@/components/ui/Spinner';
import { useIsClient } from '@/components/ui/useIsClient';
import { readLocalStats, summarize, type StatsSummary } from '@/lib/local-stats';
import type { LocalStatsFile } from '@/lib/types';
import { useMe } from '@/components/account/useMe';
import { Distribution } from './Distribution';
import { formatAverage, mergeRecords } from './stats-model';

type Source = 'merged' | 'device' | 'account';

const SOURCE_LABEL: Record<Source, string> = {
  merged: 'Merged',
  device: 'This device',
  account: 'Account',
};

function Headline({ s }: { s: StatsSummary }) {
  const items: Array<{ k: string; v: string }> = [
    { k: 'Played', v: String(s.played) },
    { k: 'Win %', v: String(s.winRate) },
    { k: 'Current streak', v: String(s.currentStreak) },
    { k: 'Max streak', v: String(s.maxStreak) },
  ];
  return (
    <dl className="gl-stats-nums">
      {items.map((it) => (
        <div key={it.k}>
          <dt>{it.k}</dt>
          <dd>{it.v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Tally({ title, s, empty }: { title: string; s: StatsSummary; empty: string }) {
  return (
    <table className="w-full text-[15px]">
      <caption className="pb-2 text-left font-semibold">{title}</caption>
      <tbody>
        {s.played === 0 ? (
          <tr>
            <td className="text-ink-dim">{empty}</td>
          </tr>
        ) : (
          <>
            {[
              ['Played', String(s.played)],
              ['Won', `${s.wins} (${s.winRate}%)`],
              ['Sent to turnaround', String(s.played - s.wins)],
              ['Average takes', formatAverage(s.averageTakes)],
            ].map(([k, v]) => (
              <tr key={k} className="border-t border-rule">
                <th scope="row" className="py-1.5 text-left font-normal text-ink-dim">
                  {k}
                </th>
                <td className="ty-num py-1.5 text-right">{v}</td>
              </tr>
            ))}
          </>
        )}
      </tbody>
    </table>
  );
}

export function StatsView() {
  const isClient = useIsClient();
  const me = useMe();
  const [source, setSource] = useState<Source>('merged');

  const local: LocalStatsFile = useMemo(() => (isClient ? readLocalStats() : { v: 1, records: {} }), [isClient]);
  const account = me.data?.user && me.data.stats ? me.data.stats.records : null;

  const file = useMemo(() => {
    const deviceRecords = Object.values(local.records);
    if (!account || source === 'device') return local;
    if (source === 'account') return mergeRecords(account);
    return mergeRecords(deviceRecords, account);
  }, [local, account, source]);

  if (!isClient) return <Spinner label="Loading your stats" showLabel />;

  const daily = summarize(file, 'daily');
  const vault = summarize(file, 'vault');
  const pitch = summarize(file, 'pitch');
  const nothing = daily.played === 0;

  return (
    <div className="grid gap-8">
      <section aria-label="Daily reels" className="grid gap-6">
        <Headline s={daily} />
        {nothing ? (
          <div className="grid justify-items-start gap-3 rounded-[var(--radius-lg)] border border-dashed border-rule p-5">
            <p className="gl-h2">Nothing in the can yet</p>
            <p className="text-ink-dim">Finish a daily reel and your streak and distribution show up here.</p>
            <ButtonLink href="/" variant="slate">
              Play today&apos;s reel
            </ButtonLink>
          </div>
        ) : (
          <div className="grid gap-2">
            <Distribution
              distribution={daily.distribution}
              caption={`Take distribution: takes 1 to ${RULES.maxGuesses} plus turnaround`}
            />
            <p className="text-sm text-ink-dim">
              <span aria-hidden="true">✕ = {COPY.lossStamp.toLowerCase()}. </span>
              Average {formatAverage(daily.averageTakes)} takes (a loss counts as {LOSS_SCORE})
              {daily.hintedPlays > 0 ? ` · ${daily.hintedPlays} with ${COPY.hintsName}` : ''}.
            </p>
          </div>
        )}
      </section>

      {vault.played + pitch.played > 0 ? (
        <section aria-labelledby="stats-archive" className="grid gap-4">
          <h2 id="stats-archive" className="gl-h2">
            Vault and pitches
          </h2>
          <p className="-mt-2 text-sm text-ink-dim">Tracked separately. They never count toward the leaderboard.</p>
          <div className="grid gap-6 sm:grid-cols-2">
            <Tally title="The Vault" s={vault} empty="No Vault reels played yet." />
            <Tally title="Pitches" s={pitch} empty="No pitches played yet." />
          </div>
        </section>
      ) : null}

      <div className="grid gap-3 border-t border-rule pt-4">
        <p className="text-sm text-ink-dim" aria-live="polite">
          {account
            ? source === 'merged'
              ? 'Showing this device and your account together.'
              : source === 'device'
                ? 'Showing results saved on this device.'
                : 'Showing results recorded on your account.'
            : me.data?.authConfigured
              ? 'Saved on this device. Sign in from Settings to sync across devices.'
              : 'Saved on this device.'}
        </p>
        {account ? (
          <div role="group" aria-label="Stats source" className="flex flex-wrap gap-2">
            {(Object.keys(SOURCE_LABEL) as Source[]).map((s) => (
              <ToggleChip key={s} pressed={source === s} onClick={() => setSource(s)}>
                {SOURCE_LABEL[s]}
              </ToggleChip>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
