// The casting board: a chain laid out like a call sheet. Actor rows (headshot, name, role) are
// joined by film rows ("via Heat, 1995"). The end actor row is a dashed "wanted" slot until the
// chain reaches it; then it fills with the match token and a check glyph (never color alone).
import type { ReactNode } from 'react';
import { StatusGlyph } from '@/components/ui/StatusGlyph';
import { Tag } from '@/components/ui/Tag';
import { cx } from '@/components/ui/cx';
import { pad2 } from '@/lib/format';
import type { CastingLink, CastingPerson } from '@/server/modes/casting-call/types';
import { Headshot } from './Headshot';

function ActorRow({
  n,
  role,
  person,
  state,
  note,
}: {
  n: number;
  role: string;
  person: CastingPerson;
  state: 'cast' | 'wanted' | 'wrapped';
  note?: ReactNode;
}) {
  const wrapped = state === 'wrapped';
  return (
    <li
      className={cx(
        'flex items-center gap-3 px-3 py-3 sm:gap-4 sm:px-4',
        state === 'wanted' && 'border border-dashed border-rule',
        wrapped && 'gl-status',
      )}
      data-verdict={wrapped ? 'match' : undefined}
      data-row="actor"
      data-person-id={person.id}
    >
      <span className="ty-num w-6 shrink-0 text-sm opacity-70" aria-hidden="true">
        {pad2(n)}
      </span>
      <Headshot name={person.name} profilePath={person.profilePath} className={state === 'wanted' ? 'opacity-70' : undefined} />
      <span className="min-w-0 flex-1">
        <span className="ty-label block">{role}</span>
        <span className="block truncate text-lg font-semibold">{person.name}</span>
        {note ? <span className="ty-micro block opacity-80">{note}</span> : null}
      </span>
      {wrapped ? (
        <span className="flex shrink-0 items-center gap-1">
          <StatusGlyph verdict="match" />
          <span className="ty-label">Wrapped</span>
        </span>
      ) : state === 'wanted' ? (
        <Tag tone="dim">Wanted</Tag>
      ) : null}
    </li>
  );
}

function FilmRow({ link, index }: { link: CastingLink; index: number }) {
  return (
    <li className="flex items-center gap-3 py-1.5 pr-3 pl-12 sm:pl-14" data-row="film" data-film-id={link.film.id}>
      <span aria-hidden="true" className="h-6 w-px shrink-0 bg-rule" />
      <span className="ty-micro text-ink-dim">Film {index + 1}</span>
      <span className="min-w-0 truncate font-mono text-sm">
        via <span className="text-ink">{link.film.title}</span> <span className="text-ink-dim">({link.film.year})</span>
      </span>
    </li>
  );
}

export interface CastingBoardProps {
  start: CastingPerson;
  end: CastingPerson;
  chain: CastingLink[];
  /** Show the dashed "wanted" end row when the chain has not reached the end actor. */
  showWanted?: boolean;
  label: string;
  /** Extra row content after the current actor (e.g. the "next link" slot). */
  pending?: ReactNode;
}

export function CastingBoard({ start, end, chain, showWanted = true, label, pending }: CastingBoardProps) {
  const reached = chain.length > 0 && chain[chain.length - 1]!.person.id === end.id;
  return (
    <ol aria-label={label} className="flex flex-col gap-1">
      <ActorRow n={1} role="Start" person={start} state="cast" />
      {chain.map((l, i) => {
        const isEnd = l.person.id === end.id;
        return [
          <FilmRow key={`f-${l.film.id}`} link={l} index={i} />,
          <ActorRow
            key={`p-${l.person.id}`}
            n={i + 2}
            role={isEnd ? 'End' : `Link ${i + 1}`}
            person={l.person}
            state={isEnd ? 'wrapped' : 'cast'}
          />,
        ];
      })}
      {!reached && pending ? pending : null}
      {!reached && showWanted ? <ActorRow n={chain.length + 2} role="End" person={end} state="wanted" note="Reach this actor to wrap" /> : null}
    </ol>
  );
}
