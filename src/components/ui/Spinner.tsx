import { IconReel } from './icons';
import { cx } from './cx';

/** A turning reel with a status role. Static under reduced motion. */
export function Spinner({
  label = 'Loading',
  showLabel = false,
  className,
}: {
  label?: string;
  showLabel?: boolean;
  className?: string;
}) {
  return (
    <span role="status" className={cx('gl-spinner', className)}>
      <IconReel />
      <span className={showLabel ? 'ty-label' : 'sr-only'}>{label}</span>
    </span>
  );
}
