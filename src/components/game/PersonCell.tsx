import { ArtImage } from '@/components/art/ArtImage';
import { PersonArt } from '@/components/art/PersonArt';
import type { CSSProperties } from 'react';
import { tmdbImage } from '@/config/brand';
import { StatusGlyph } from '@/components/ui/StatusGlyph';
import { Tag } from '@/components/ui/Tag';
import { cellAriaLabel } from '@/components/ui/status';
import { cx } from '@/components/ui/cx';
import { initials } from '@/lib/format';

export type PersonRole = 'director' | 'lead' | 'supporting';

const ROLE_LABEL: Record<PersonRole, string> = {
  director: 'Director',
  lead: 'Lead',
  supporting: 'Supporting',
};

const ANSWER_ROLE_TAG: Record<'lead' | 'supp' | 'director', string> = {
  lead: 'LEAD',
  supp: 'SUPP',
  director: 'DIR',
};

const ANSWER_ROLE_WORDS: Record<'lead' | 'supp' | 'director', string> = {
  lead: 'in the answer as lead',
  supp: 'in the answer as supporting cast',
  director: 'directed the answer',
};

export interface PersonCellProps {
  role: PersonRole;
  /** null renders the dashed empty slot. */
  person: {
    name: string;
    profilePath: string | null;
    verdict: 'match' | 'miss';
    answerRole?: 'lead' | 'supp' | 'director';
  } | null;
  /** Number of directors in a co-directing unit; > 1 draws a split portrait. */
  unitSize?: number;
  /** 1-based slot number for supporting cells, used in the spoken label. */
  slot?: number;
  index?: number;
  animate?: boolean;
}

/**
 * People cell (Section 6.4): a full-bleed headshot tile, or an initials tile when TMDB has no
 * headshot. The WHOLE tile tints green on a match (one signal), with a check glyph. A role tag
 * (LEAD / SUPP) appears only after a match, as information. Name below.
 */
export function PersonCell({ role, person, unitSize = 1, slot, index, animate = false }: PersonCellProps) {
  const label = role === 'supporting' && slot ? `Supporting ${slot}` : ROLE_LABEL[role];
  const style = index !== undefined ? ({ '--i': index } as CSSProperties) : undefined;

  if (!person) {
    return (
      <div
        className={cx('gm-person', animate && 'anim-flip')}
        style={style}
        data-verdict="empty"
        role="img"
        aria-label={cellAriaLabel({ label, verdict: 'empty' })}
      >
        <div className="gm-person__tile" data-verdict="empty" />
        <span className="gm-person__name" aria-hidden="true">
          &nbsp;
        </span>
      </div>
    );
  }

  const { verdict } = person;
  const src = tmdbImage(person.profilePath, 'w185');
  const tag = verdict === 'match' && person.answerRole && role !== 'director' ? person.answerRole : null;
  const unit = role === 'director' && unitSize > 1;
  const aria = cellAriaLabel({
    label,
    value: unit ? `${person.name}, a ${unitSize} person directing unit` : person.name,
    verdict,
    extra: tag ? ANSWER_ROLE_WORDS[tag] : null,
  });
  const letters = initials(person.name);

  return (
    <div
      className={cx('gm-person', animate && 'anim-flip')}
      style={style}
      data-verdict={verdict}
      role="img"
      aria-label={aria}
    >
      <div className="gm-person__tile gl-status" data-verdict={verdict}>
        {unit ? (
          <span className="gm-person__split">
            <span>{letters[0]}</span>
            <span>{letters[1] ?? letters[0]}</span>
          </span>
        ) : (
          <PersonArt person={{ name: person.name }} tone="status" style={{ position: 'absolute', inset: 0 }} />
        )}
        <ArtImage src={src} alt="" width={96} height={120} />
        {verdict === 'match' ? (
          <span className="gm-person__glyph">
            <StatusGlyph verdict="match" />
          </span>
        ) : null}
        {unit ? (
          <span className="gm-person__unit">
            <Tag tone="dim">x{unitSize}</Tag>
          </span>
        ) : null}
        {tag ? (
          <span className="gm-person__tag">
            <Tag>{ANSWER_ROLE_TAG[tag]}</Tag>
          </span>
        ) : null}
      </div>
      <span className="gm-person__name" aria-hidden="true">
        {person.name}
      </span>
    </div>
  );
}
