import { cx } from '@/components/ui/cx';

/** The REC light. The one sanctioned decorative use of --red-rec; blinks unless motion is reduced. */
export function RecDot({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cx('gl-rec', className)} />;
}
