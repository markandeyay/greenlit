'use client';
// Film library basic edit form: eligibility and the editable required fields. Score is frozen
// at ingest; director, cast and certifications come from TMDB ingest and are shown read only.
import { useMemo, useState } from 'react';
import type { SearchResult } from '@/lib/types';
import type { AdminFilmDetail, AdminFilmPatch } from '@/server/admin/types';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { FilmPicker } from '@/components/pitch/FilmPicker';
import { adminGet, adminPost, errorMessage, makeAdminSearch } from './admin-api';

const field = 'w-full border border-rule bg-bg px-2 py-2 text-ink';

function EditForm({ detail, onSaved }: { detail: AdminFilmDetail; onSaved: (d: AdminFilmDetail) => void }) {
  const f = detail.film;
  const [tagline, setTagline] = useState(f.tagline ?? '');
  const [box, setBox] = useState(f.boxOfficeUsd === null ? '' : String(f.boxOfficeUsd));
  const [keywords, setKeywords] = useState(f.keywords.join(', '));
  const [genres, setGenres] = useState<number[]>(f.genreIds);
  const [eligible, setEligible] = useState(f.isAnswerEligible);
  const [playable, setPlayable] = useState(f.isPlayable);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const boxNum = box.trim() ? Number(box.replace(/[,_\s$]/g, '')) : null;
    if (boxNum !== null && (!Number.isInteger(boxNum) || boxNum <= 0)) {
      setMsg('✕ Box office must be a whole number of US dollars.');
      return;
    }
    const patch: AdminFilmPatch = {
      tagline: tagline.trim() || null,
      boxOfficeUsd: boxNum,
      keywords: keywords.split(',').map((k) => k.trim()).filter(Boolean),
      genreIds: genres,
      isAnswerEligible: eligible,
      isPlayable: playable,
    };
    setBusy(true);
    setMsg(null);
    try {
      const d = await adminPost<AdminFilmDetail>('/api/admin/films', { id: f.id, patch });
      onSaved(d);
      setMsg('✓ Saved.');
    } catch (err) {
      setMsg(`✕ ${errorMessage(err)}`);
    } finally {
      setBusy(false);
    }
  };

  const us = detail.certifications.find((c) => c.region === 'US')?.rating ?? null;

  return (
    <div className="grid gap-4">
      <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1 font-mono text-sm">
        <dt className="text-ink-dim">TMDB id</dt>
        <dd>{f.id}</dd>
        <dt className="text-ink-dim">Director</dt>
        <dd>{detail.directorNames.join(', ') || 'missing'} ({f.directorUnit.display || 'no display name'})</dd>
        <dt className="text-ink-dim">Lead</dt>
        <dd>{detail.leadName ?? 'missing'}</dd>
        <dt className="text-ink-dim">Supporting</dt>
        <dd>{detail.supportingNames.join(', ') || 'none'}</dd>
        <dt className="text-ink-dim">Studio</dt>
        <dd>{detail.studio?.name ?? 'none'}</dd>
        <dt className="text-ink-dim">US rating</dt>
        <dd>{us ?? 'missing'}</dd>
        <dt className="text-ink-dim">Score</dt>
        <dd>{f.scoreSnapshot ?? 'missing'} (frozen)</dd>
      </dl>
      {detail.missing.length ? (
        <p className="border-l-2 border-ink pl-3 text-sm">✕ Missing for scheduling: {detail.missing.join(', ')}.</p>
      ) : (
        <p className="text-sm">✓ Schedulable.</p>
      )}
      <label htmlFor="film-tagline" className="block">
        <span className="ty-label block text-ink-dim">Tagline</span>
        <input id="film-tagline" className={field} value={tagline} onChange={(e) => setTagline(e.target.value)} />
      </label>
      <label htmlFor="film-box" className="block">
        <span className="ty-label block text-ink-dim">Worldwide box office (USD)</span>
        <input id="film-box" inputMode="numeric" className={field} value={box} onChange={(e) => setBox(e.target.value)} />
      </label>
      <label htmlFor="film-kw" className="block">
        <span className="ty-label block text-ink-dim">Keywords (comma separated)</span>
        <input id="film-kw" className={field} value={keywords} onChange={(e) => setKeywords(e.target.value)} />
      </label>
      <fieldset>
        <legend className="ty-label text-ink-dim">Genres (1 to 5)</legend>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          {detail.genres.map((g) => (
            <label key={g.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={genres.includes(g.id)}
                onChange={(e) => setGenres((cur) => (e.target.checked ? [...cur, g.id] : cur.filter((x) => x !== g.id)))}
              />
              {g.name}
            </label>
          ))}
        </div>
      </fieldset>
      <Switch checked={playable} onChange={setPlayable} label="Playable (appears in search)" />
      <Switch checked={eligible} onChange={setEligible} label="Answer eligible (can be a daily answer)" />
      <p className="text-xs text-ink-dim">
        Edits apply everywhere the film appears, including past reels in the Vault. Rebuild the search index after title changes in the ingest.
      </p>
      <div className="flex items-center gap-3">
        <Button variant="solid" onClick={save} disabled={busy}>
          {busy ? 'Saving' : 'Save film'}
        </Button>
        <p role="status" aria-live="polite" className="text-sm">
          {msg}
        </p>
      </div>
    </div>
  );
}

export function FilmsPanel() {
  const [eligibleOnly, setEligibleOnly] = useState(false);
  const [picked, setPicked] = useState<SearchResult | null>(null);
  const [detail, setDetail] = useState<AdminFilmDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const search = useMemo(() => makeAdminSearch(eligibleOnly), [eligibleOnly]);

  const choose = async (f: SearchResult | null) => {
    setPicked(f);
    setDetail(null);
    setError(null);
    if (!f) return;
    try {
      setDetail(await adminGet<AdminFilmDetail>(`/api/admin/films/${f.id}`));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className="grid max-w-2xl gap-4">
      <Switch checked={eligibleOnly} onChange={setEligibleOnly} label="Search answer-eligible films only" />
      <FilmPicker key={String(eligibleOnly)} value={picked} onChange={(f) => void choose(f)} label="Film" search={search} placeholder="Search the library" />
      {error ? <p role="alert">✕ {error}</p> : null}
      {detail ? <EditForm key={detail.film.id + ':' + detail.film.isAnswerEligible} detail={detail} onSaved={setDetail} /> : null}
    </div>
  );
}
