'use client';
// /leaderboard body: Weekly / All time / Streaks tabs, a "No notes" filter, and a ranked table
// styled like a call sheet. The signed-in player's row is marked with a YOU tag and a rule.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { COPY } from '@/config/brand';
import { ButtonLink } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Switch } from '@/components/ui/Switch';
import { Tabs } from '@/components/ui/Tabs';
import { Tag } from '@/components/ui/Tag';
import { useMe } from '@/components/account/useMe';
import type { LeaderboardPeriod, LeaderboardResponse } from '@/lib/types';
import { PERIOD_LABELS, formatValue, periodBlurb, valueHeading } from './rules';

type Load =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; board: LeaderboardResponse };

function useBoard(period: LeaderboardPeriod, noNotes: boolean): Load & { retry: () => void } {
  const [state, setState] = useState<{ key: string; load: Load }>({ key: '', load: { status: 'loading' } });
  const [attempt, setAttempt] = useState(0);
  const key = `${period}:${noNotes}:${attempt}`;

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/leaderboard?period=${period}&noNotes=${noNotes}`, { signal: ctrl.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const board = (await res.json()) as LeaderboardResponse;
        setState({ key, load: { status: 'ready', board } });
      })
      .catch((err: unknown) => {
        if ((err as { name?: string })?.name === 'AbortError') return;
        setState({ key, load: { status: 'error' } });
      });
    return () => ctrl.abort();
  }, [period, noNotes, key]);

  const load: Load = state.key === key ? state.load : { status: 'loading' };
  return { ...load, retry: () => setAttempt((n) => n + 1) };
}

function Board({ period, noNotes, me, authConfigured }: {
  period: LeaderboardPeriod;
  noNotes: boolean;
  me: string | null;
  authConfigured: boolean;
}) {
  const load = useBoard(period, noNotes);

  return (
    <div className="grid gap-4">
      <p className="max-w-[var(--measure)] text-ink-dim">
        {periodBlurb(period)}
        {noNotes ? ` Only reels finished without ${COPY.hintsName} count.` : ''}
      </p>

      {load.status === 'loading' ? (
        <Spinner label="Rolling credits" showLabel />
      ) : load.status === 'error' ? (
        <div className="grid justify-items-start gap-3">
          <p>The credits did not load.</p>
          <button type="button" className="gl-btn" onClick={load.retry}>
            Try again
          </button>
        </div>
      ) : load.board.rows.length === 0 ? (
        <EmptyBoard period={period} authConfigured={authConfigured} />
      ) : (
        <div className="gl-sheet__scroll" role="region" aria-label={`${PERIOD_LABELS[period]} leaderboard`} tabIndex={0}>
          <table className="gl-sheet">
            <caption>
              {[PERIOD_LABELS[period], noNotes ? `No ${COPY.hintsName.toLowerCase()}` : null, `${load.board.rows.length} billed`]
                .filter(Boolean)
                .join(' · ')}
            </caption>
            <thead>
              <tr>
                <th scope="col" className="w-[1%] text-right!">
                  No.
                </th>
                <th scope="col">Player</th>
                <th scope="col" className="w-[1%] text-right!">
                  {valueHeading(period)}
                </th>
                <th scope="col" className="w-[1%] text-right! max-sm:hidden">
                  Played
                </th>
                <th scope="col" className="w-[1%] text-right! max-sm:hidden">
                  Wins
                </th>
              </tr>
            </thead>
            <tbody>
              {load.board.rows.map((r) => {
                const isMe = me !== null && r.handle === me;
                return (
                  <tr
                    key={`${r.rank}-${r.handle}`}
                    aria-current={isMe ? 'true' : undefined}
                    className={isMe ? 'bg-surface-2 shadow-[inset_4px_0_0_var(--ink)]' : undefined}
                  >
                    <td className="ty-num text-right!">{String(r.rank).padStart(2, '0')}</td>
                    <th scope="row" className="break-all normal-case! whitespace-normal!">
                      {r.handle}
                      {isMe ? (
                        <>
                          {' '}
                          <Tag tone="solid">You</Tag>
                        </>
                      ) : null}
                      <span className="mt-1 block text-xs font-normal text-ink-dim sm:hidden">
                        {r.played} played · {r.wins} wins
                      </span>
                    </th>
                    <td className="ty-num text-right! text-ink">{formatValue(period, r.value)}</td>
                    <td className="ty-num text-right! max-sm:hidden">{r.played}</td>
                    <td className="ty-num text-right! max-sm:hidden">{r.wins}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EmptyBoard({ period, authConfigured }: { period: LeaderboardPeriod; authConfigured: boolean }) {
  return (
    <div className="grid justify-items-start gap-3 border border-dashed border-rule p-6">
      <p className="ty-display text-[length:var(--t-d3)]">The credits are blank</p>
      <p className="text-ink-dim">
        {!authConfigured
          ? 'Accounts open soon. Boards fill up once players can sign in, so for now your takes live in Stats.'
          : period === 'streak'
            ? 'Nobody has a live streak yet. Greenlight today’s reel to start one.'
            : 'Nobody qualifies yet. Signed-in players appear here once they wrap enough daily reels.'}
      </p>
      <div className="flex flex-wrap gap-2">
        <ButtonLink href="/" variant="slate">
          Play today&apos;s reel
        </ButtonLink>
        <ButtonLink href={authConfigured ? '/settings' : '/stats'} variant="outline">
          {authConfigured ? 'Sign in' : 'Your stats'}
        </ButtonLink>
      </div>
    </div>
  );
}

export function LeaderboardView({ authConfigured }: { authConfigured: boolean }) {
  const [period, setPeriod] = useState<LeaderboardPeriod>('week');
  const [noNotes, setNoNotes] = useState(false);
  const me = useMe();
  const myName = me.data?.user ? me.data.boardName : null;

  return (
    <div className="grid gap-6">
      <Switch
        checked={noNotes}
        onChange={setNoNotes}
        label="No notes"
        description={`Only count reels finished without ${COPY.hintsName}.`}
      />
      <Tabs
        label="Leaderboard period"
        value={period}
        onChange={(id) => setPeriod(id as LeaderboardPeriod)}
        tabs={(Object.keys(PERIOD_LABELS) as LeaderboardPeriod[]).map((p) => ({
          id: p,
          label: PERIOD_LABELS[p],
          content: <Board period={p} noNotes={noNotes} me={myName} authConfigured={authConfigured} />,
        }))}
      />
      {authConfigured && me.data && !me.data.user ? (
        <p className="text-sm text-ink-dim">
          Only signed-in players are billed. <Link className="underline underline-offset-2" href="/settings">
            Sign in
          </Link> to
          take your place.
        </p>
      ) : null}
    </div>
  );
}
