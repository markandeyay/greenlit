// The chain: a vertical line of actor portraits joined by "in <film>" connectors. The end actor is
// a dashed goal slot until the chain reaches it; then it fills with the match token and a check
// glyph plus the word "Connected" (never color alone).
import type { ReactNode } from 'react';
import { StatusGlyph } from '@/components/ui/StatusGlyph';
import { cx } from '@/components/ui/cx';
import type { CastingLink, CastingPerson } from '@/server/modes/casting-call/types';
import { Headshot } from './Headshot';

type NodeState = 'cast' | 'goal' | 'connected';

function ActorNode({ role, person, state }: { role: string; person: CastingPerson; state: NodeState }) {
  return (
    <li
      className={cx(
        'flex items-center gap-3 rounded-[var(--radius)] p-2',
        state === 'goal' && 'border-[1.5px] border-dashed border-ink-faint',
        state === 'connected' && 'gl-status',
      )}
      data-verdict={state === 'connected' ? 'match' : undefined}
      data-row="actor"
      data-person-id={person.id}
    >
      <span className="flex w-12 shrink-0 justify-center">
        <Headshot name={person.name} profilePath={person.profilePath} className={state === 'goal' ? 'opacity-75' : undefined} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-bold tracking-[0.08em] uppercase opacity-70">{role}</span>
        <span className="block text-[17px] leading-tight font-semibold break-words">{person.name}</span>
      </span>
      {state === 'connected' ? (
        <span className="flex shrink-0 items-center gap-1 pr-1 text-sm font-bold">
          <StatusGlyph verdict="match" />
          <span>Connected</span>
        </span>
      ) : null}
    </li>
  );
}

/** The vertical line between two actors, carrying the film that links them. */
function Connector({ children, dashed = false, row, filmId }: { children: ReactNode; dashed?: boolean; row: 'film' | 'pending'; filmId?: number }) {
  return (
    <li className="flex items-stretch gap-3 px-2" data-row={row} data-film-id={filmId}>
      <span aria-hidden="true" className="flex w-12 shrink-0 justify-center">
        <span className={cx('w-0 border-l-2', dashed ? 'border-dashed border-ink-faint' : 'border-ink')} />
      </span>
      <span className="flex min-h-9 min-w-0 flex-1 items-center py-1 text-[15px]">{children}</span>
    </li>
  );
}

export interface CastingBoardProps {
  start: CastingPerson;
  end: CastingPerson;
  chain: CastingLink[];
  /** Show the dashed goal slot when the chain has not reached the end actor. */
  showWanted?: boolean;
  label: string;
  /** Text for the open connector after the current actor (e.g. "Pick a film"). */
  pending?: ReactNode;
}

export function CastingBoard({ start, end, chain, showWanted = true, label, pending }: CastingBoardProps) {
  const reached = chain.length > 0 && chain[chain.length - 1]!.person.id === end.id;
  return (
    <ol aria-label={label} className="flex flex-col">
      <ActorNode role="Start" person={start} state="cast" />
      {chain.map((l, i) => {
        const isEnd = l.person.id === end.id;
        return [
          <Connector key={`f-${l.film.id}`} row="film" filmId={l.film.id}>
            <span className="min-w-0">
              <span className="text-ink-dim">in </span>
              <span className="font-semibold">{l.film.title}</span> <span className="text-ink-dim tabular-nums">({l.film.year})</span>
            </span>
          </Connector>,
          <ActorNode key={`p-${l.person.id}`} role={isEnd ? 'End' : `Link ${i + 1}`} person={l.person} state={isEnd ? 'connected' : 'cast'} />,
        ];
      })}
      {!reached && showWanted ? (
        <>
          <Connector dashed row="pending">
            <span className="text-ink-dim">{pending ?? '...'}</span>
          </Connector>
          <ActorNode role="Goal" person={end} state="goal" />
        </>
      ) : null}
    </ol>
  );
}
