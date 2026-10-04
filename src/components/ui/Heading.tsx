import { Fragment, type ElementType, type ReactNode } from 'react';
import { cx } from './cx';

/** The italic serif accent word inside a bold condensed heading: "The <Accent>Vault</Accent>". */
export function Accent({ children }: { children: ReactNode }) {
  return <em className="ty-accent">{children}</em>;
}
/** Alias matching the design doc's name for the motif. */
export const ItalicAccent = Accent;

/** Split "The *Vault*" into plain and accent segments. Pure. */
export function parseAccent(text: string): Array<{ text: string; accent: boolean }> {
  return text
    .split(/(\*[^*]+\*)/g)
    .filter((p) => p.length > 0)
    .map((p) =>
      p.length > 2 && p.startsWith('*') && p.endsWith('*')
        ? { text: p.slice(1, -1), accent: true }
        : { text: p, accent: false },
    );
}

/** Render "The *Vault*" with the starred words as Accent. */
export function AccentText({ text }: { text: string }) {
  return (
    <>
      {parseAccent(text).map((seg, i) =>
        seg.accent ? <Accent key={i}>{seg.text}</Accent> : <Fragment key={i}>{seg.text}</Fragment>,
      )}
    </>
  );
}

const SIZE: Record<string, string> = {
  mega: 'text-[length:var(--t-mega)]',
  d1: 'text-[length:var(--t-d1)]',
  d2: 'text-[length:var(--t-d2)]',
  d3: 'text-[length:var(--t-d3)]',
};

/** Display heading: Big Shoulders 900, uppercase. Accepts children or an accent string. */
export function DisplayHeading({
  as: Tag = 'h2',
  size = 'd2',
  text,
  children,
  className,
  id,
}: {
  as?: ElementType;
  size?: 'mega' | 'd1' | 'd2' | 'd3';
  /** "The *Vault*" style string, used when children are not given. */
  text?: string;
  children?: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <Tag id={id} className={cx('ty-display', SIZE[size], className)}>
      {children ?? (text ? <AccentText text={text} /> : null)}
    </Tag>
  );
}
