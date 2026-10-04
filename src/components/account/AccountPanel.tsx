'use client';
// Account section of /settings: "accounts open soon" in keyless mode, sign in when signed out,
// handle + sign out when signed in.
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Tag } from '@/components/ui/Tag';
import { HandleForm } from './HandleForm';
import { SignInPanel } from './SignInPanel';
import { useMe } from './useMe';

const AUTH_NOTICES: Record<string, string> = {
  error: 'That sign-in link did not work. It may have expired. Try again.',
  unavailable: 'Accounts are not available yet.',
  signedout: 'You are signed out. Your takes stay on this device.',
};

function useAuthNotice(): string | null {
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    try {
      const key = new URLSearchParams(window.location.search).get('auth');
      // Reading the URL once after mount; nothing else drives this state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (key && AUTH_NOTICES[key]) setNotice(AUTH_NOTICES[key]);
    } catch {
      /* ignore */
    }
  }, []);
  return notice;
}

export function AccountsOpenSoon() {
  return (
    <div className="grid gap-2">
      <p className="ty-label">
        <Tag tone="dim">In pre-production</Tag>
      </p>
      <p>Accounts open soon.</p>
      <p className="text-ink-dim">
        For now everything lives on this device: your takes, streaks and stats. When accounts open you can sign in
        and bring them with you, then claim a spot on the leaderboard.
      </p>
    </div>
  );
}

export function AccountPanel({ authConfigured }: { authConfigured: boolean }) {
  const me = useMe();
  const notice = useAuthNotice();

  if (!authConfigured) return <AccountsOpenSoon />;

  const body = (() => {
    if (me.status === 'idle' || (me.status === 'loading' && !me.data)) {
      return <Spinner label="Checking your account" showLabel />;
    }
    if (me.status === 'error') {
      return (
        <div className="grid gap-3">
          <p>Could not reach your account just now.</p>
          <div>
            <Button variant="outline" onClick={() => void me.refresh()}>
              Try again
            </Button>
          </div>
        </div>
      );
    }
    const data = me.data;
    if (!data?.authConfigured) return <AccountsOpenSoon />;
    if (!data.user) return <SignInPanel />;
    return (
      <div className="grid gap-6">
        <dl className="grid gap-1">
          <dt className="ty-label">Signed in as</dt>
          <dd className="break-all font-mono">{data.user.email ?? 'your account'}</dd>
          <dt className="ty-label mt-3">On the boards as</dt>
          <dd className="font-mono">
            {data.boardName}
            {!data.profile?.handle ? <span className="ml-2 text-sm text-ink-dim">(pick a handle below)</span> : null}
          </dd>
        </dl>
        <HandleForm current={data.profile?.handle ?? null} onSaved={() => void me.refresh()} />
        <form action="/auth/signout" method="post">
          <Button type="submit" variant="ghost">
            Sign out
          </Button>
        </form>
      </div>
    );
  })();

  return (
    <div className="grid gap-4">
      {notice ? (
        <p role="status" className="border-l-2 border-ink pl-3 text-sm">
          {notice}
        </p>
      ) : null}
      {body}
    </div>
  );
}
