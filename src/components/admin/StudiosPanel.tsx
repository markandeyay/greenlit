'use client';
// Studio aliases (Section 4.5): fold raw TMDB production company ids into headline studios.
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { AdminStudiosResponse } from '@/server/admin/types';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { adminGet, adminPost, errorMessage } from './admin-api';

const field = 'w-full border border-rule bg-bg px-2 py-2 text-ink';

export function StudiosPanel() {
  const [data, setData] = useState<AdminStudiosResponse | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [rawId, setRawId] = useState('');
  const [studioId, setStudioId] = useState('');
  const [name, setName] = useState('');
  const [filter, setFilter] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await adminGet<AdminStudiosResponse>('/api/admin/studios'));
    } catch (err) {
      setMsg(`✕ ${errorMessage(err)}`);
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const run = async (body: unknown, ok: string) => {
    setMsg(null);
    try {
      setData(await adminPost<AdminStudiosResponse>('/api/admin/studios', body));
      setMsg(`✓ ${ok}`);
      return true;
    } catch (err) {
      setMsg(`✕ ${errorMessage(err)}`);
      return false;
    }
  };

  if (!data) return msg ? <p role="alert">{msg}</p> : <Spinner label="Loading studios" showLabel />;
  const studioName = new Map(data.studios.map((s) => [s.id, s.name]));
  const f = filter.trim().toLowerCase();
  const aliases = data.aliases.filter((a) => !f || String(a.rawCompanyId).includes(f) || (studioName.get(a.studioId) ?? '').toLowerCase().includes(f));

  const addAlias = async (e: FormEvent) => {
    e.preventDefault();
    if (await run({ action: 'alias', rawCompanyId: Number(rawId), studioId: Number(studioId) }, 'Alias saved.')) setRawId('');
  };
  const addStudio = async (e: FormEvent) => {
    e.preventDefault();
    if (await run({ action: 'create', name }, `Studio "${name.trim()}" created.`)) setName('');
  };

  return (
    <div className="grid gap-8">
      <p role="status" aria-live="polite" className="min-h-5 text-sm">
        {msg}
      </p>
      <div className="grid gap-6 md:grid-cols-2">
        <form onSubmit={addAlias} className="grid gap-3 border border-rule p-3" aria-label="Map a company to a studio">
          <p className="ty-label">Map a TMDB company</p>
          <label htmlFor="alias-raw" className="block">
            <span className="ty-label block text-ink-dim">TMDB company id</span>
            <input id="alias-raw" inputMode="numeric" required pattern="[0-9]+" className={field} value={rawId} onChange={(e) => setRawId(e.target.value)} />
          </label>
          <label htmlFor="alias-studio" className="block">
            <span className="ty-label block text-ink-dim">Headline studio</span>
            <select id="alias-studio" required className={field} value={studioId} onChange={(e) => setStudioId(e.target.value)}>
              <option value="">Choose a studio</option>
              {data.studios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <div>
            <Button type="submit" variant="solid">
              Save alias
            </Button>
          </div>
        </form>
        <form onSubmit={addStudio} className="grid content-start gap-3 border border-rule p-3" aria-label="Create a studio">
          <p className="ty-label">Create a headline studio</p>
          <label htmlFor="studio-name" className="block">
            <span className="ty-label block text-ink-dim">Name</span>
            <input id="studio-name" required className={field} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <div>
            <Button type="submit" variant="outline">
              Create studio
            </Button>
          </div>
        </form>
      </div>
      <section aria-labelledby="alias-table">
        <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
          <h3 id="alias-table" className="ty-label">
            Aliases (<span className="tabular-nums">{data.aliases.length}</span>)
          </h3>
          <label htmlFor="alias-filter" className="text-sm">
            <span className="sr-only">Filter aliases</span>
            <input id="alias-filter" placeholder="Filter by id or studio" className={field} value={filter} onChange={(e) => setFilter(e.target.value)} />
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-rule font-mono text-xs uppercase tracking-widest text-ink-dim">
                <th scope="col" className="py-2 pr-3">Company id</th>
                <th scope="col" className="py-2 pr-3">Headline studio</th>
                <th scope="col" className="py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {aliases.map((a) => (
                <tr key={a.rawCompanyId} className="border-b border-rule">
                  <td className="py-1 pr-3 font-mono tabular-nums">{a.rawCompanyId}</td>
                  <td className="py-1 pr-3">{studioName.get(a.studioId) ?? `#${a.studioId}`}</td>
                  <td className="py-1 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Remove alias ${a.rawCompanyId}`}
                      onClick={() => void run({ action: 'unalias', rawCompanyId: a.rawCompanyId }, 'Alias removed.')}
                    >
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
