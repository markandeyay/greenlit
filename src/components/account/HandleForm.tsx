'use client';
// Handle picker: 3 to 20 letters, numbers or underscores, unique. Shown on leaderboards.
import { useId, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { HANDLE_MAX, validateHandle } from './handle-rules';
import type { ProfileUpdateResponse } from './types';

export function HandleForm({
  current,
  onSaved,
}: {
  current: string | null;
  onSaved: (res: ProfileUpdateResponse) => void;
}) {
  const inputId = useId();
  const msgId = useId();
  const [value, setValue] = useState(current ?? '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const check = validateHandle(value);
    if (!check.ok) {
      setMsg({ ok: false, text: check.message });
      return;
    }
    if (check.handle === current) {
      setMsg({ ok: true, text: 'That is already your handle.' });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ handle: check.handle }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setMsg({ ok: false, text: body?.error?.message ?? 'Could not save that handle. Try again.' });
      } else {
        setMsg({ ok: true, text: `Saved. You are billed as ${check.handle}.` });
        onSaved(body as ProfileUpdateResponse);
      }
    } catch {
      setMsg({ ok: false, text: 'Could not reach the server. Try again.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-2" noValidate>
      <label htmlFor={inputId} className="ty-label">
        Handle
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id={inputId}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={HANDLE_MAX + 5}
          autoComplete="nickname"
          autoCapitalize="off"
          spellCheck={false}
          aria-describedby={msgId}
          aria-invalid={msg?.ok === false || undefined}
          placeholder="e.g. night_owl_42"
          className="min-h-11 min-w-0 flex-1 basis-48 rounded-sm border border-rule bg-surface-2 px-3 font-mono text-ink placeholder:text-ink-dim focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        />
        <Button type="submit" variant="solid" disabled={busy}>
          {busy ? 'Saving' : current ? 'Change' : 'Save handle'}
        </Button>
      </div>
      <p id={msgId} role="status" aria-live="polite" className="min-h-[1.5em] text-sm">
        {msg ? (
          <span className="text-ink">
            <span aria-hidden="true">{msg.ok ? '✓ ' : '! '}</span>
            {msg.text}
          </span>
        ) : (
          <span className="text-ink-dim">3 to {HANDLE_MAX} characters: letters, numbers and underscores.</span>
        )}
      </p>
    </form>
  );
}
