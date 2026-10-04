'use client';
// Hand-edit Script Notes candidates (admin). Typed form per hint type, or raw JSON.
import { useId, useState } from 'react';
import { HINT_TYPE_LABELS } from '@/config/hints';
import type { Hint, HintType } from '@/lib/types';
import { Button } from '@/components/ui/Button';

/** Types an admin may pick for a daily puzzle (creator_note belongs to pitches). */
export const DAILY_HINT_TYPES = (Object.keys(HINT_TYPE_LABELS) as HintType[]).filter((t) => t !== 'creator_note');

/** A blank payload for a type. Pure; exported for tests. */
export function emptyHint(type: HintType): Hint {
  switch (type) {
    case 'plot_keywords':
      return { type, payload: { keywords: [] } };
    case 'cast_connection':
      return { type, payload: { personName: '', filmTitle: '', filmYear: new Date().getFullYear() } };
    case 'filmography':
      return { type, payload: { films: [] } };
    case 'first_letter':
      return { type, payload: { letter: '' } };
    default:
      return { type, payload: { text: '' } } as Hint;
  }
}

/** "Title (1999)" lines <-> filmography payload. Pure; exported for tests. */
export function parseFilmLines(text: string): { title: string; year: number }[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const m = /^(.*?)\s*\((\d{4})\)\s*$/.exec(l);
      return m ? { title: m[1]!.trim(), year: Number(m[2]) } : { title: l, year: 0 };
    });
}

const field = 'w-full border border-rule bg-bg px-2 py-2 text-sm text-ink';

function HintFields({ hint, onChange, idBase }: { hint: Hint; onChange: (h: Hint) => void; idBase: string }) {
  switch (hint.type) {
    case 'plot_keywords':
      return (
        <label className="block text-sm" htmlFor={`${idBase}-kw`}>
          <span className="ty-label text-ink-dim">Keywords (comma separated, 3 to 5)</span>
          <input
            id={`${idBase}-kw`}
            className={field}
            value={hint.payload.keywords.join(', ')}
            onChange={(e) => onChange({ type: 'plot_keywords', payload: { keywords: e.target.value.split(',').map((k) => k.trimStart()) } })}
            onBlur={(e) => onChange({ type: 'plot_keywords', payload: { keywords: e.target.value.split(',').map((k) => k.trim()).filter(Boolean) } })}
          />
        </label>
      );
    case 'cast_connection':
      return (
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_6rem]">
          <label className="block text-sm" htmlFor={`${idBase}-p`}>
            <span className="ty-label text-ink-dim">Actor</span>
            <input id={`${idBase}-p`} className={field} value={hint.payload.personName} onChange={(e) => onChange({ ...hint, payload: { ...hint.payload, personName: e.target.value } })} />
          </label>
          <label className="block text-sm" htmlFor={`${idBase}-f`}>
            <span className="ty-label text-ink-dim">Other film</span>
            <input id={`${idBase}-f`} className={field} value={hint.payload.filmTitle} onChange={(e) => onChange({ ...hint, payload: { ...hint.payload, filmTitle: e.target.value } })} />
          </label>
          <label className="block text-sm" htmlFor={`${idBase}-y`}>
            <span className="ty-label text-ink-dim">Year</span>
            <input id={`${idBase}-y`} type="number" inputMode="numeric" className={field} value={hint.payload.filmYear} onChange={(e) => onChange({ ...hint, payload: { ...hint.payload, filmYear: Number(e.target.value) } })} />
          </label>
        </div>
      );
    case 'filmography':
      return (
        <label className="block text-sm" htmlFor={`${idBase}-fl`}>
          <span className="ty-label text-ink-dim">Films, one per line: Title (Year)</span>
          <textarea
            id={`${idBase}-fl`}
            rows={3}
            className={field}
            defaultValue={hint.payload.films.map((f) => `${f.title} (${f.year})`).join('\n')}
            onBlur={(e) => onChange({ type: 'filmography', payload: { films: parseFilmLines(e.target.value) } })}
          />
        </label>
      );
    case 'first_letter':
      return (
        <label className="block text-sm" htmlFor={`${idBase}-l`}>
          <span className="ty-label text-ink-dim">Letter</span>
          <input id={`${idBase}-l`} maxLength={2} className={`${field} w-20`} value={hint.payload.letter} onChange={(e) => onChange({ type: 'first_letter', payload: { letter: e.target.value.toUpperCase() } })} />
        </label>
      );
    default:
      return (
        <label className="block text-sm" htmlFor={`${idBase}-t`}>
          <span className="ty-label text-ink-dim">Text</span>
          <textarea id={`${idBase}-t`} rows={2} className={field} value={hint.payload.text} onChange={(e) => onChange({ ...hint, payload: { text: e.target.value } } as Hint)} />
        </label>
      );
  }
}

function OneHint({ hint, index, onChange }: { hint: Hint; index: number; onChange: (h: Hint) => void }) {
  const idBase = useId();
  const [json, setJson] = useState<string | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);
  return (
    <fieldset className="grid gap-2 border border-rule p-3">
      <legend className="ty-label px-1">Candidate {index + 1}</legend>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm" htmlFor={`${idBase}-type`}>
          <span className="ty-label block text-ink-dim">Type</span>
          <select
            id={`${idBase}-type`}
            className="border border-rule bg-bg px-2 py-2 text-sm text-ink"
            value={hint.type}
            onChange={(e) => {
              setJson(null);
              onChange(emptyHint(e.target.value as HintType));
            }}
          >
            {DAILY_HINT_TYPES.map((t) => (
              <option key={t} value={t}>
                {HINT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <Button
          size="sm"
          variant="ghost"
          aria-pressed={json !== null}
          onClick={() => {
            setJsonError(null);
            setJson(json === null ? JSON.stringify(hint.payload, null, 2) : null);
          }}
        >
          {json === null ? 'Edit JSON' : 'Typed form'}
        </Button>
      </div>
      {json !== null ? (
        <label className="block text-sm" htmlFor={`${idBase}-json`}>
          <span className="ty-label text-ink-dim">Payload JSON</span>
          <textarea
            id={`${idBase}-json`}
            rows={5}
            className={`${field} font-mono`}
            value={json}
            aria-invalid={jsonError ? true : undefined}
            onChange={(e) => {
              setJson(e.target.value);
              try {
                onChange({ type: hint.type, payload: JSON.parse(e.target.value) } as Hint);
                setJsonError(null);
              } catch {
                setJsonError('Not valid JSON yet.');
              }
            }}
          />
          {jsonError ? <span className="font-mono text-xs">✕ {jsonError}</span> : null}
        </label>
      ) : (
        <HintFields key={hint.type} hint={hint} onChange={onChange} idBase={idBase} />
      )}
    </fieldset>
  );
}

/** `version` remounts the fields when a fresh draft replaces the hints. */
export function HintEditor({ hints, onChange, version = 0 }: { hints: Hint[]; onChange: (hints: Hint[]) => void; version?: number }) {
  return (
    <div className="grid gap-3">
      {hints.map((h, i) => (
        <OneHint key={`${version}-${i}`} index={i} hint={h} onChange={(next) => onChange(hints.map((x, j) => (j === i ? next : x)))} />
      ))}
    </div>
  );
}

/** Read-only rendering of a hint (preview). */
export function HintPreview({ hint }: { hint: Hint }) {
  let body: string;
  switch (hint.type) {
    case 'plot_keywords':
      body = hint.payload.keywords.join(' · ');
      break;
    case 'cast_connection':
      body = `${hint.payload.personName} was in ${hint.payload.filmTitle} (${hint.payload.filmYear})`;
      break;
    case 'filmography':
      body = hint.payload.films.map((f) => `${f.title} (${f.year})`).join(', ');
      break;
    case 'first_letter':
      body = `Starts with ${hint.payload.letter}`;
      break;
    default:
      body = hint.payload.text;
  }
  return (
    <div className="text-sm">
      <span className="ty-label mr-2 text-ink-dim">{HINT_TYPE_LABELS[hint.type]}</span>
      {body}
    </div>
  );
}
