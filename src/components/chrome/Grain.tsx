import { cx } from '@/components/ui/cx';

/**
 * Film grain and a soft projector vignette over the whole page. Pure CSS (an SVG turbulence
 * tile), pointer-events none, aria-hidden. `live` shifts the grain in four steps on fine-pointer
 * devices; the shift stops under reduced motion (globals.css).
 */
export function Grain({ live = true, className }: { live?: boolean; className?: string }) {
  return <div aria-hidden="true" className={cx('gl-grain', live && 'gl-grain--live', className)} />;
}
