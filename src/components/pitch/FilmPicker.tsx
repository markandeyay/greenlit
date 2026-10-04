'use client';
// Film picker for /pitch (WS8). A small WAI-ARIA combobox over public/search-index.json (every
// playable film, reveals nothing) with /api/search as a fallback. Keyboard: Up / Down move,
// Enter picks, Escape closes. Only the creator's own choice is ever shown.
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { SEARCH } from '@/config/game';
import { normalizeForSearch, scoreTitleMatch } from '@/lib/search';
import type { SearchIndexEntry, SearchIndexFile, SearchResponse, SearchResult } from '@/lib/types';
import { cx } from '@/components/ui/cx';
import { FilmPoster } from './FilmPoster';

let indexPromise: Promise<SearchIndexEntry[] | null> | null = null;

function loadIndex(): Promise<SearchIndexEntry[] | null> {
  if (!indexPromise) {
    indexPromise = fetch('/search-index.json')
      .then((r) => (r.ok ? (r.json() as Promise<SearchIndexFile>) : null))
      .then((f) => (f && Array.isArray(f.films) ? f.films : null))
      .catch(() => null);
  }
  return indexPromise;
}

/** Rank index entries for a query. Pure; exported for tests. */
export function rankFilms(films: SearchIndexEntry[], query: string, limit: number = SEARCH.maxResults): SearchResult[] {
  const q = normalizeForSearch(query);
  if (q.length < SEARCH.minQueryLength) return [];
  return films
    .map((f) => ({ f, s: Math.max(scoreTitleMatch(q, f.title), f.originalTitle ? scoreTitleMatch(q, f.originalTitle) : 0) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || b.f.year - a.f.year)
    .slice(0, limit)
    .map(({ f }) => ({ id: f.id, title: f.title, year: f.year, posterPath: f.posterPath }));
}

export interface FilmPickerProps {
  value: SearchResult | null;
  onChange: (film: SearchResult | null) => void;
  label?: string;
  /** Optional custom search (admin uses its own endpoint). */
  search?: (q: string) => Promise<SearchResult[]>;
  placeholder?: string;
  id?: string;
}

export function FilmPicker({ value, onChange, label = 'Film', search, placeholder = 'Search a title', id }: FilmPickerProps) {
  const autoId = useId();
  const inputId = id ?? `${autoId}-input`;
  const listId = `${autoId}-list`;
  const hintId = `${autoId}-hint`;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const runSearch = useCallback(
    async (q: string) => {
      const mine = ++seq.current;
      if (normalizeForSearch(q).length < SEARCH.minQueryLength) {
        setResults([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      let found: SearchResult[] = [];
      try {
        if (search) found = await search(q);
        else {
          const idx = await loadIndex();
          if (idx) found = rankFilms(idx, q);
          else {
            const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
            found = r.ok ? ((await r.json()) as SearchResponse).results : [];
          }
        }
      } catch {
        found = [];
      }
      if (mine !== seq.current) return;
      setResults(found);
      setActive(found.length ? 0 : -1);
      setLoading(false);
    },
    [search],
  );

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => void runSearch(query), search ? 200 : 60);
    return () => clearTimeout(t);
  }, [query, open, runSearch, search]);

  const pick = (film: SearchResult) => {
    onChange(film);
    setOpen(false);
    setQuery('');
    setResults([]);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (results.length ? (i + 1) % results.length : -1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (results.length ? (i - 1 + results.length) % results.length : -1));
    } else if (e.key === 'Enter') {
      if (open && active >= 0 && results[active]) {
        e.preventDefault();
        pick(results[active]);
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        setOpen(false);
      }
    }
  };

  const showList = open && normalizeForSearch(query).length >= SEARCH.minQueryLength;
  const status = useMemo(() => {
    if (!showList) return '';
    if (loading) return 'Searching';
    return results.length ? `${results.length} films found. Use up and down to choose.` : 'No films match.';
  }, [showList, loading, results.length]);

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-[var(--radius)] border border-ink bg-bg p-3">
        <FilmPoster title={value.title} posterPath={value.posterPath} />
        <div className="min-w-0 flex-1">
          <p className="ty-label text-ink-dim">{label}</p>
          <p className="truncate font-display text-xl font-black uppercase">{value.title}</p>
          <p className="font-mono text-sm text-ink-dim tabular-nums">{value.year}</p>
        </div>
        <button
          type="button"
          className="gl-btn gl-btn--ghost gl-btn--sm"
          onClick={() => {
            onChange(null);
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
        >
          <span>Change</span>
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <label htmlFor={inputId} className="mb-2 block font-semibold">
        {label}
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
        aria-describedby={hintId}
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
          if (!search) void loadIndex();
        }}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
        className="w-full rounded-[var(--radius)] border border-rule bg-bg px-3 py-3 text-base text-ink placeholder:text-ink-dim"
      />
      <p id={hintId} className="sr-only">
        Type at least {SEARCH.minQueryLength} characters, then pick a film from the list.
      </p>
      <p className="sr-only" role="status" aria-live="polite">
        {status}
      </p>
      {showList ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={`${label} results`}
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-80 overflow-y-auto border border-ink bg-surface shadow-lg"
        >
          {results.map((f, i) => (
            <li
              key={f.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(f);
              }}
              onMouseEnter={() => setActive(i)}
              className={cx(
                'flex cursor-pointer items-center gap-3 border-b border-rule px-3 py-2 last:border-b-0',
                i === active && 'bg-surface-2 outline outline-1 -outline-offset-1 outline-ink',
              )}
            >
              <FilmPoster title={f.title} posterPath={f.posterPath} />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{f.title}</span>
                <span className="font-mono text-sm text-ink-dim tabular-nums">{f.year}</span>
              </span>
              {i === active ? (
                <span aria-hidden="true" className="font-mono text-xs text-ink-dim">
                  ENTER
                </span>
              ) : null}
            </li>
          ))}
          {!loading && results.length === 0 ? <li className="px-3 py-3 text-ink-dim">No films match.</li> : null}
          {loading && results.length === 0 ? <li className="px-3 py-3 text-ink-dim">Searching...</li> : null}
        </ul>
      ) : null}
    </div>
  );
}
