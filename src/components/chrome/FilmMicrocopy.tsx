import { cx } from '@/components/ui/cx';

/** Decorative production microcopy: "24 fps · 2.39 : 1". Hidden from assistive tech. */
export function FilmMicrocopy({
  items = ['24 fps', '2.39 : 1'],
  className,
}: {
  items?: readonly string[];
  className?: string;
}) {
  return (
    <span aria-hidden="true" className={cx('gl-micro', className)}>
      {items.map((t) => (
        <span key={t}>{t}</span>
      ))}
    </span>
  );
}
