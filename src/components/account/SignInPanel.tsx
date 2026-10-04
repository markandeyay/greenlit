'use client';
// Sign in with an email magic link, Google or X (Supabase Auth).
import { useId, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { OAUTH_PROVIDERS, type OAuthProviderId } from '@/lib/supabase/config';
import { authCallbackUrl, getBrowserSupabase } from '@/lib/supabase/client';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Status = { kind: 'idle' } | { kind: 'busy' } | { kind: 'sent'; email: string } | { kind: 'error'; message: string };

export function SignInPanel({ next = '/settings' }: { next?: string }) {
  const emailId = useId();
  const msgId = useId();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const sendLink = async (e: FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setStatus({ kind: 'error', message: 'That email does not look right. Check it and try again.' });
      return;
    }
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setStatus({ kind: 'error', message: 'Sign in is not available right now.' });
      return;
    }
    setStatus({ kind: 'busy' });
    const { error } = await supabase.auth.signInWithOtp({
      email: value,
      options: { emailRedirectTo: authCallbackUrl(next) },
    });
    setStatus(
      error
        ? { kind: 'error', message: 'We could not send the link. Wait a minute and try again.' }
        : { kind: 'sent', email: value },
    );
  };

  const oauth = async (provider: OAuthProviderId) => {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setStatus({ kind: 'error', message: 'Sign in is not available right now.' });
      return;
    }
    setStatus({ kind: 'busy' });
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: authCallbackUrl(next) } });
    if (error) setStatus({ kind: 'error', message: 'That provider is not available right now. Try email instead.' });
  };

  const busy = status.kind === 'busy';

  return (
    <div className="grid gap-5">
      <p className="text-ink-dim">
        Optional. An account puts you on the leaderboard and keeps your stats across devices. Takes you already played
        on this device come with you.
      </p>

      <div className="flex flex-wrap gap-2">
        {OAUTH_PROVIDERS.map((p) => (
          <Button key={p.id} variant="outline" onClick={() => oauth(p.id)} disabled={busy}>
            Continue with {p.label}
          </Button>
        ))}
      </div>

      <form onSubmit={sendLink} className="grid gap-2" noValidate>
        <label htmlFor={emailId} className="ty-label">
          Or get a magic link by email
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            id={emailId}
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-describedby={msgId}
            aria-invalid={status.kind === 'error' || undefined}
            placeholder="you@example.com"
            className="min-h-11 min-w-0 flex-1 basis-56 rounded-sm border border-rule bg-surface-2 px-3 font-mono text-ink placeholder:text-ink-dim focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          />
          <Button type="submit" variant="solid" disabled={busy}>
            {busy ? 'Sending' : 'Send link'}
          </Button>
        </div>
        <p id={msgId} role="status" aria-live="polite" className="min-h-[1.5em] text-sm">
          {status.kind === 'sent' ? (
            <span>
              Check your inbox. We sent a sign-in link to <b>{status.email}</b>.
            </span>
          ) : status.kind === 'error' ? (
            <span className="text-ink">
              <span aria-hidden="true">! </span>
              {status.message}
            </span>
          ) : null}
        </p>
      </form>
    </div>
  );
}
