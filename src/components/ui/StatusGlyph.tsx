import { cx } from './cx';
import { statusGlyph, type CellVerdict } from './status';

/** ✓ for match, ≈ for close, nothing for miss / n/a. Decorative: pair it with an aria-label. */
export function StatusGlyph({ verdict, className }: { verdict: CellVerdict; className?: string }) {
  const g = statusGlyph(verdict);
  if (!g) return null;
  return (
    <span aria-hidden="true" className={cx('gl-glyph', className)} data-glyph={verdict}>
      {g}
    </span>
  );
}
