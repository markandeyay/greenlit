import type { CSSProperties, ElementType, ReactNode } from 'react';
import { cx } from './cx';
import { StatusGlyph } from './StatusGlyph';
import { cellAriaLabel, type CellVerdict } from './status';

export interface StatusCellProps {
  verdict: CellVerdict;
  /** Attribute label, e.g. "Year". */
  label: string;
  /** Visible value, e.g. "2006" or "$1.2B" or "N/A". */
  value?: ReactNode;
  /** Direction word for numeric cells ("LATER"); hidden on match. */
  direction?: string | null;
  /** Corner tag, e.g. <Tag>LEAD</Tag>, shown only after a match. */
  tag?: ReactNode;
  /** Full spoken label. Defaults to cellAriaLabel(label, value, verdict, direction). */
  ariaLabel?: string;
  /** Stagger index for the flip-in animation (--i * 80ms). */
  index?: number;
  /** Play the flip-in on mount (disabled automatically under reduced motion). */
  animate?: boolean;
  as?: ElementType;
  className?: string;
  children?: ReactNode;
}

/**
 * Base guess cell (Section 6.4 NumberCell / LabelCell foundation). Whole-cell fill per verdict,
 * a glyph for match/close, colorblind patterns via [data-colorblind], and one aria-label.
 * Content inside is presentational; the label speaks for it.
 */
export function StatusCell({
  verdict,
  label,
  value,
  direction,
  tag,
  ariaLabel,
  index,
  animate = false,
  as: Tag = 'div',
  className,
  children,
}: StatusCellProps) {
  const spoken =
    ariaLabel ??
    cellAriaLabel({
      label,
      value: typeof value === 'string' || typeof value === 'number' ? value : null,
      verdict,
      direction: verdict === 'match' ? null : direction,
    });
  const style = index !== undefined ? ({ '--i': index } as CSSProperties) : undefined;
  return (
    <Tag
      role="img"
      aria-label={spoken}
      data-verdict={verdict}
      className={cx('gl-cell', animate && 'anim-flip', className)}
      style={style}
    >
      <span className="gl-cell__label">{label}</span>
      {children ?? <span className="gl-cell__value">{value ?? ' '}</span>}
      {direction && verdict !== 'match' ? <span className="gl-cell__dir">{direction}</span> : null}
      <StatusGlyph verdict={verdict} className="gl-cell__glyph" />
      {tag ? <span className="gl-cell__tag">{tag}</span> : null}
    </Tag>
  );
}
