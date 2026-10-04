'use client';
// /stats body. Local stats from this device (readLocalStats + summarize); when signed in, the
// account's server-recorded results are fetched from /api/me and can be merged in.
import { useMemo, useState } from 'react';
import { LOSS_SCORE } from '@/config/game';
import { COPY } from '@/config/brand';
import { RULES } from '@/config/rules';
import { SceneHeading } from '@/components/chrome/SceneHeading';
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
  const items: Array<{ k: string; v: string; note?: string }> = [
    { k: 'Played', v: String(s.played) },
    { k: 'Win %', v: `${s.winRate}` },
    { k: 'Current streak', v: String(s.currentStreak) },
    { k: 'Max streak', v: String(s.maxStreak) },
    { k: 'Avg takes', v: formatAverage(s.averageTakes), note: `loss counts as ${LOSS_SCORE}` },
    { k: 'With notes', v: String(s.hintedPlays), note: COPY.hintsName },
  ];
  return (
    <dl className="grid grid-cols-2 gap-px border border-ink bg-rule sm:grid-cols-3 lg:grid-cols-6">
      {items.map((it) => (
        <div key={it.k} className="grid content-start gap-1 bg-bg p-3 sm:p-4">
          <dt className="ty-label">{it.k}</dt>
          <dd className="ty-num text-[length:var(--t-d3)] leading-none text-ink">{it.v}</dd>
          {it.note ? <dd className="text-xs text-ink-dim">{it.note}</dd> : null}
        </div>
      ))}
    </dl>
  );
}

function Tally({ title, s, empty }: { title: string; s: StatsSummary; empty: string }) {
  return (
    <div className="gl-sheet__scroll" role="region" aria-label={title} tabIndex={0}>
      <table className="gl-sheet">
        <caption>{title}</caption>
        <tbody>
          {s.played === 0 ? (
            <tr>
              <td className="text-ink-dim">{empty}</td>
            </tr>
          ) : (
            <>
              <tr>
                <th scope="row">Played</th>
                <td className="ty-num">{s.played}</td>
              </tr>
              <tr>
                <th scope="row">{COPY.winStamp}</th>
                <td className="ty-num">
                  {s.wins} ({s.winRate}%)
                </td>
              </tr>
              <tr>
                <th scope="row">Turnaround</th>
                <td className="ty-num">{s.played - s.wins}</td>
              </tr>
              <tr>
                <th scope="row">Avg takes</th>
                <td className="ty-num">{formatAverage(s.averageTakes)}</td>
              </tr>
              <tr>
                <th scope="row">With notes</th>
                <td className="ty-num">{s.hintedPlays}</td>
              </tr>
            </>
          )}
        </tbody>
      </table>
    </div>
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
  const nothing = daily.played + vault.played + pitch.played === 0;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-dim" aria-live="polite">
          {account
            ? source === 'merged'
              ? 'Showing this device and your account together.'
              : source === 'device'
                ? 'Showing results saved on this device.'
                : 'Showing results recorded on your account.'
            : me.data?.authConfigured
              ? 'Stats saved on this device. Sign in from Settings to sync them across devices.'
              : 'Stats saved on this device.'}
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

      {nothing ? (
        <div className="mt-10 grid justify-items-start gap-4 border border-dashed border-rule p-6">
          <p className="ty-display text-[length:var(--t-d3)]">Nothing in the can yet</p>
          <p className="text-ink-dim">Finish a reel and your takes, streaks and distribution show up here.</p>
          <ButtonLink href="/" variant="slate">
            Play today&apos;s reel
          </ButtonLink>
        </div>
      ) : null}

      <section className="gl-section mt-12" aria-labelledby="stats-dailies">
        <SceneHeading
          n={1}
          slug="INT. THE DAILIES - NIGHT"
          title="The *dailies*"
          meta="Daily reels"
          id="stats-dailies"
        />
        <div className="gl-section__body grid gap-8">
          <Headline s={daily} />
          <Distribution
            distribution={daily.distribution}
            caption={`Take distribution: takes 1 to ${RULES.maxGuesses} plus turnaround`}
          />
        </div>
      </section>

      <section className="gl-section" aria-labelledby="stats-archive">
        <SceneHeading
          n={2}
          slug="INT. THE VAULT - DAY"
          title="Vault *and* pitches"
          meta="Tracked separately, never on the leaderboard"
          id="stats-archive"
        />
        <div className="gl-section__body grid gap-6 md:grid-cols-2">
          <Tally title="The Vault" s={vault} empty="No Vault reels played yet." />
          <Tally title="Pitches" s={pitch} empty="No pitches played yet." />
        </div>
      </section>
    </div>
  );
}
