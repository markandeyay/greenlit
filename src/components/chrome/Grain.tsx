import { cx } from '@/components/ui/cx';

/**
 * A faint paper-fiber texture over the whole page (an SVG turbulence tile, multiplied) with a warm
 * edge falloff. Pointer-events none, aria-hidden. The texture is still: `live` is kept for API
 * compatibility and only adds a class.
 */
export function Grain({ live = true, className }: { live?: boolean; className?: string }) {
  return <div aria-hidden="true" className={cx('gl-grain', live && 'gl-grain--live', className)} />;
}
