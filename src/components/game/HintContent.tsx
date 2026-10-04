import type { ReactNode } from 'react';
import { HINT_TYPE_LABELS } from '@/config/hints';
import type { Hint } from '@/lib/types';

/** Plain-text form of a hint, for live-region announcements. */
export function hintText(hint: Hint): string {
  switch (hint.type) {
    case 'tagline':
    case 'awards':
    case 'sequel_status':
    case 'decade_vibe':
    case 'creator_note':
      return hint.payload.text;
    case 'plot_keywords':
      return hint.payload.keywords.join(', ');
    case 'cast_connection':
      return `${hint.payload.personName} is also in ${hint.payload.filmTitle} (${hint.payload.filmYear}).`;
    case 'filmography':
      return `The director also made ${hint.payload.films.map((f) => `${f.title} (${f.year})`).join(', ')}.`;
    case 'first_letter':
      return `The title starts with ${hint.payload.letter}.`;
  }
}

/** A revealed Script Note, typed out on a script page. */
export function HintContent({ hint }: { hint: Hint }) {
  const label = HINT_TYPE_LABELS[hint.type];
  let body: ReactNode;
  switch (hint.type) {
    case 'tagline':
      body = <p className="font-serif text-[22px] leading-snug italic">&ldquo;{hint.payload.text}&rdquo;</p>;
      break;
    case 'creator_note':
      body = <p className="text-[15px] leading-relaxed">&ldquo;{hint.payload.text}&rdquo;</p>;
      break;
    case 'plot_keywords':
      body = (
        <ul className="flex flex-wrap gap-1.5" aria-label="Keywords">
          {hint.payload.keywords.map((k) => (
            <li key={k} className="rounded-[2px] border border-current px-2 py-0.5 text-[13px] font-bold uppercase">
              {k}
            </li>
          ))}
        </ul>
      );
      break;
    case 'cast_connection':
      body = (
        <p className="text-[15px] leading-relaxed">
          <strong>{hint.payload.personName}</strong> is also in <strong>{hint.payload.filmTitle}</strong> (
          {hint.payload.filmYear}).
        </p>
      );
      break;
    case 'filmography':
      body = (
        <div className="text-[15px] leading-relaxed">
          <p>The director also made:</p>
          <ul className="mt-1 grid gap-0.5">
            {hint.payload.films.map((f) => (
              <li key={`${f.title}-${f.year}`}>
                <strong>{f.title}</strong> ({f.year})
              </li>
            ))}
          </ul>
        </div>
      );
      break;
    case 'first_letter':
      body = (
        <p className="flex items-baseline gap-3 text-[15px]">
          The title starts with
          <span className="ty-display text-[44px] leading-none">{hint.payload.letter}</span>
        </p>
      );
      break;
    default:
      body = <p className="text-[15px] leading-relaxed">{hint.payload.text}</p>;
  }
  return (
    <div>
      <p className="text-[11px] font-bold tracking-[0.14em] uppercase opacity-70">{label}</p>
      <div className="mt-2">{body}</div>
    </div>
  );
}
