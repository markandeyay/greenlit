'use client';
// Themed weeks (Section 5): set or clear a theme across a date range of scheduled reels.
import { useState, type FormEvent } from 'react';
import type { AdminThemeResult } from '@/server/admin/types';
import { Button } from '@/components/ui/Button';
import { adminPost, errorMessage } from './admin-api';

const field = 'w-full border border-rule bg-bg px-2 py-2 text-ink';

export function ThemeForm({ defaultFrom, onDone }: { defaultFrom: string; onDone: () => void }) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultFrom);
  const [theme, setTheme] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const apply = async (value: string | null) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await adminPost<AdminThemeResult>('/api/admin/schedule', { action: 'theme', fromDate: from, toDate: to, theme: value });
      setMsg(
        `${value ? 'Theme set' : 'Theme cleared'} on ${r.updated.length} reel${r.updated.length === 1 ? '' : 's'}.` +
          (r.skipped.length ? ` ${r.skipped.length} date${r.skipped.length === 1 ? ' has' : 's have'} no reel yet: ${r.skipped.join(', ')}.` : ''),
      );
      onDone();
    } catch (err) {
      setMsg(`✕ ${errorMessage(err)}`);
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void apply(theme.trim() || null);
  };

  return (
    <form onSubmit={submit} className="grid max-w-xl gap-4">
      <p className="text-sm text-ink-dim">
        A themed run is a scheduling feature: schedule the films first, then label the range (for example &quot;Nolan Week&quot;). Only future reels can change.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label htmlFor="theme-from" className="block">
          <span className="ty-label block text-ink-dim">From</span>
          <input id="theme-from" type="date" required className={field} value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label htmlFor="theme-to" className="block">
          <span className="ty-label block text-ink-dim">To</span>
          <input id="theme-to" type="date" required className={field} value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>
      <label htmlFor="theme-name" className="block">
        <span className="ty-label block text-ink-dim">Theme</span>
        <input id="theme-name" className={field} value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="Best Picture Winners" />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="solid" disabled={busy || !theme.trim()}>
          Apply theme
        </Button>
        <Button variant="ghost" disabled={busy} onClick={() => void apply(null)}>
          Clear theme in range
        </Button>
      </div>
      <p role="status" aria-live="polite" className="min-h-5 text-sm">
        {msg}
      </p>
    </form>
  );
}
