import Image from 'next/image';
import { tmdbImage } from '@/config/brand';
import { cx } from '@/components/ui/cx';
import { initials } from '@/lib/format';

/** Headshot tile: the TMDB profile image when there is one, otherwise an initials card. Decorative. */
export function Headshot({
  name,
  profilePath,
  size = 'md',
  className,
}: {
  name: string;
  profilePath: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const src = tmdbImage(profilePath, 'w185');
  const box = size === 'sm' ? 'h-10 w-8' : size === 'lg' ? 'h-24 w-[4.5rem]' : 'h-16 w-12';
  const text = size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-3xl' : 'text-xl';
  return (
    <span
      aria-hidden="true"
      className={cx(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius)] border border-rule bg-surface-2',
        box,
        className,
      )}
    >
      {src ? (
        <Image src={src} alt="" fill sizes="96px" unoptimized className="object-cover" />
      ) : (
        <>
          <span className="pointer-events-none absolute inset-x-1 top-1 h-px bg-ink-faint" />
          <span className={cx('ty-display leading-none text-ink', text)}>{initials(name)}</span>
          <span className="pointer-events-none absolute inset-x-1 bottom-1 h-px bg-ink-faint" />
        </>
      )}
    </span>
  );
}
