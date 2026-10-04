import type { ElementType, ReactNode } from 'react';
import { AccentText } from '@/components/ui/Heading';
import { cx } from '@/components/ui/cx';

export interface SceneHeadingProps {
  /** Scene number, shown in both margins: 1 -> "01". */
  n: number | string;
  /** Slugline: "INT. THE CALL SHEET - NIGHT". INT. / EXT. are set dim. */
  slug: string;
  /** Title. A string may mark accent words with asterisks: "The *Vault*". */
  title: ReactNode;
  /** Parenthetical under the slugline, e.g. "Everything you have learned so far". */
  meta?: ReactNode;
  as?: ElementType;
  size?: 'sm' | 'md' | 'lg';
  id?: string;
  className?: string;
}

const SLUG_RE = /^(INT\.\/EXT\.|INT\.|EXT\.)\s*(.*)$/i;

/** Split a slugline into its INT./EXT. prefix and the rest. Pure. */
export function splitSlug(slug: string): { prefix: string | null; rest: string } {
  const m = slug.match(SLUG_RE);
  return m ? { prefix: m[1]!.toUpperCase(), rest: m[2]! } : { prefix: null, rest: slug };
}

/**
 * A script-page section head (SFA SectionHead): the scene number in both margins with the
 * slugline between them, a parenthetical, then the display title with an italic serif accent.
 * The heading element contains only the title, so the outline reads cleanly.
 */
export function SceneHeading({ n, slug, title, meta, as: Tag = 'h2', size = 'md', id, className }: SceneHeadingProps) {
  const num = typeof n === 'number' ? String(n).padStart(2, '0') : n;
  const { prefix, rest } = splitSlug(slug);
  return (
    <header className={cx('gl-scene', size === 'sm' && 'gl-scene--sm', size === 'lg' && 'gl-scene--lg', className)}>
      <div className="gl-scene__rule">
        <span className="gl-scene__n" aria-hidden="true">
          {num}
        </span>
        <span className="gl-scene__ln" aria-hidden="true" />
        <p className="gl-scene__slug">
          <span className="sr-only">Scene {num}: </span>
          {prefix ? <em>{prefix}</em> : null}
          {prefix ? ' ' : null}
          {rest}
        </p>
        <span className="gl-scene__ln" aria-hidden="true" />
        <span className="gl-scene__n" aria-hidden="true">
          {num}
        </span>
      </div>
      {meta ? <p className="gl-scene__meta">({meta})</p> : null}
      <Tag id={id} className="gl-scene__title ty-display">
        {typeof title === 'string' ? <AccentText text={title} /> : title}
      </Tag>
    </header>
  );
}
