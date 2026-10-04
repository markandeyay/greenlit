'use client';

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { SEARCH } from '@/config/game';
import { Spinner } from '@/components/ui/Spinner';
import { cx } from '@/components/ui/cx';
import { gameApi } from '@/lib/game/api';
import { loadSearchIndex, searchIndex } from '@/lib/game/search-index';
import { normalizeForSearch } from '@/lib/search';
import type { SearchResult } from '@/lib/types';
import { Poster } from './Poster';

export type SearchFn = (query: string) => Promise<SearchResult[]>;

/** Instant search over the static index; falls back to GET /api/search if the index cannot load. */
export const defaultSearch: SearchFn = async (query) => {
  try {
    const films = await loadSearchIndex();
    return searchIndex(films, query);
  } catch {
    const res = await gameApi.search(query);
    return res.results.slice(0, SEARCH.maxResults);
  }
};

export interface SearchBoxProps {
  /** Selecting a title submits the guess. */
  onSelect: (film: SearchResult) => void;
  /** Film ids already guessed this round; shown but not selectable. */
  guessedIds: ReadonlySet<number>;
  /** A guess is in flight: input is read-only and the list is closed. */
  busy?: boolean;
  /** Label text (the input's accessible name). */
  label: string;
  /** Keep the label for assistive tech only (compact layouts). */
  hideLabel?: boolean;
  /** Placeholder when idle. */
  placeholder?: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  search?: SearchFn;
  className?: string;
}

function nextEnabled(results: SearchResult[], guessed: ReadonlySet<number>, from: number, step: 1 | -1): number {
  const n = results.length;
  if (n === 0) return -1;
  for (let k = 1; k <= n; k++) {
    const i = (((from + step * k) % n) + n) % n;
    if (!guessed.has(results[i]!.id)) return i;
  }
  return -1;
}

/**
 * Film search (Sections 4.1, 6.4): an ARIA 1.2 combobox with a listbox popup, keyboard first
 * (Up / Down to move, Enter to shoot, Escape to close then clear, "/" to focus from anywhere),
 * poster thumbs with a typographic fallback, and already-guessed titles shown struck and disabled.
 */
export function SearchBox({
  onSelect,
  guessedIds,
  busy = false,
  label,
  hideLabel = false,
  placeholder = 'Start typing a title',
  inputRef,
  search = defaultSearch,
  className,
}: SearchBoxProps) {
  const id = useId();
  const listId = `${id}-list`;
  const hintId = `${id}-hint`;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchedFor, setSearchedFor] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);
  const localRef = useRef<HTMLInputElement | null>(null);

  const fieldRef = inputRef ?? localRef;

  // "/" focuses the search from anywhere on the page (unless typing elsewhere).
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      e.preventDefault();
      fieldRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fieldRef]);

  const runSearch = useCallback(
    (value: string) => {
      const q = value.trim();
      const mine = ++seq.current;
      if (normalizeForSearch(q).length < SEARCH.minQueryLength) {
        setResults([]);
        setSearchedFor('');
        setOpen(false);
        setActive(-1);
        setLoading(false);
        return;
      }
      setLoading(true);
      search(q)
        .then((r) => {
          if (mine !== seq.current) return;
          setResults(r);
          setSearchedFor(q);
          setOpen(true);
          setActive(nextEnabled(r, guessedIds, -1, 1));
        })
        .catch(() => {
          if (mine !== seq.current) return;
          setResults([]);
          setSearchedFor(q);
          setOpen(true);
          setActive(-1);
        })
        .finally(() => {
          if (mine === seq.current) setLoading(false);
        });
    },
    [search, guessedIds],
  );

  const choose = (i: number) => {
    const film = results[i];
    if (!film || busy || guessedIds.has(film.id)) return;
    seq.current++;
    setQuery('');
    setResults([]);
    setSearchedFor('');
    setOpen(false);
    setActive(-1);
    setLoading(false);
    onSelect(film);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (busy) {
      if (e.key === 'Enter') e.preventDefault();
      return;
    }
    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        if (!open && results.length) {
          setOpen(true);
          if (active < 0) setActive(nextEnabled(results, guessedIds, -1, 1));
          return;
        }
        setActive((a) => nextEnabled(results, guessedIds, a, 1));
        return;
      }
      case 'ArrowUp': {
        e.preventDefault();
        if (!open && results.length) {
          setOpen(true);
          return;
        }
        setActive((a) => nextEnabled(results, guessedIds, a < 0 ? 0 : a, -1));
        return;
      }
      case 'Enter': {
        e.preventDefault();
        if (open && active >= 0) choose(active);
        return;
      }
      case 'Escape': {
        if (open) {
          e.preventDefault();
          setOpen(false);
        } else if (query) {
          e.preventDefault();
          seq.current++;
          setQuery('');
          setResults([]);
          setSearchedFor('');
        }
        return;
      }
      case 'Tab':
        setOpen(false);
        return;
      default:
        return;
    }
  };

  const showList = open && !busy && results.length > 0;
  const showEmpty = open && !busy && !loading && results.length === 0 && searchedFor !== '';
  const activeId = showList && active >= 0 ? `${id}-opt-${active}` : undefined;
  const status = showList
    ? `${results.length} ${results.length === 1 ? 'film' : 'films'} found. Use up and down arrows to browse, Enter to shoot.`
    : showEmpty
      ? 'No film by that title in the library.'
      : '';

  return (
    <div className={cx('gm-search relative', className)}>
      <label
        htmlFor={`${id}-input`}
        className={hideLabel ? 'sr-only' : 'ty-label mb-2 flex items-center justify-between gap-3 text-ink'}
      >
        <span>{label}</span>
        {hideLabel ? null : (
          <span className="hidden items-center gap-1.5 text-ink-dim sm:inline-flex" aria-hidden="true">
            Press <span className="gm-kbd">/</span> to search
          </span>
        )}
      </label>
      <div className="gm-search__field" data-busy={busy || undefined}>
        <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" className="flex-none text-ink-dim">
          <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M15.5 15.5 21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          ref={fieldRef}
          id={`${id}-input`}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          aria-describedby={hintId}
          aria-busy={busy || undefined}
          readOnly={busy}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="go"
          placeholder={busy ? 'Rolling...' : placeholder}
          className="gm-search__input"
          style={{ outline: "none", boxShadow: "none" }}
          value={query}
          onChange={(e) => {
            if (busy) return;
            setQuery(e.target.value);
            runSearch(e.target.value);
          }}
          onFocus={() => {
            loadSearchIndex().catch(() => {});
            if (results.length) setOpen(true);
          }}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
        />
        {busy || loading ? (
          <Spinner label={busy ? 'Rolling' : 'Searching'} />
        ) : hideLabel && !query ? (
          <span className="gm-kbd hidden lg:inline-grid" aria-hidden="true" title="Press / to search">
            /
          </span>
        ) : null}
      </div>
      <p id={hintId} className="sr-only">
        Type at least {SEARCH.minQueryLength} letters. Picking a film submits your take.
      </p>

      <ul
        id={listId}
        role="listbox"
        aria-label="Films"
        className={cx('gm-search__list', !showList && 'hidden')}
      >
        {showList
          ? results.map((film, i) => {
              const guessed = guessedIds.has(film.id);
              return (
                <li
                  key={film.id}
                  id={`${id}-opt-${i}`}
                  role="option"
                  aria-selected={i === active}
                  aria-disabled={guessed || undefined}
                  className="gm-search__opt"
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseMove={() => {
                    if (!guessed && i !== active) setActive(i);
                  }}
                  onClick={() => choose(i)}
                >
                  <Poster title={film.title} year={film.year} posterPath={film.posterPath} size="xs" />
                  <span className="min-w-0 flex-1">
                    <span className="gm-search__title block truncate font-bold">{film.title}</span>
                    <span className="gm-search__year font-mono text-[13px] tabular-nums">{film.year}</span>
                  </span>
                  {guessed ? (
                    <span className="gl-tag gl-tag--dim">Already shot</span>
                  ) : i === active ? (
                    <span className="hidden font-mono text-[11px] font-bold tracking-widest uppercase sm:inline" aria-hidden="true">
                      Enter ↵
                    </span>
                  ) : null}
                </li>
              );
            })
          : null}
      </ul>
      {showEmpty ? (
        <div className="gm-search__list px-4 py-3 font-mono text-sm text-ink-dim" aria-hidden="true">
          No film by that title in the library. Try the original title or fewer words.
        </div>
      ) : null}
      <p className="sr-only" role="status" aria-live="polite">
        {status}
      </p>
    </div>
  );
}
