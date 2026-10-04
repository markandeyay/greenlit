import Link from 'next/link';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import { cx } from './cx';

export type ButtonVariant = 'slate' | 'solid' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  /** Small mono suffix, e.g. "TK 04". */
  take?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
}

export function buttonClass(variant: ButtonVariant = 'outline', size: ButtonSize = 'md', block = false) {
  return cx(
    'gl-btn',
    variant === 'slate' && 'gl-btn--slate',
    variant === 'solid' && 'gl-btn--solid',
    variant === 'ghost' && 'gl-btn--ghost',
    variant === 'danger' && 'gl-btn--danger',
    size === 'sm' && 'gl-btn--sm',
    size === 'lg' && 'gl-btn--lg',
    block && 'gl-btn--block',
  );
}

function Inner({ variant, take, icon, children }: Pick<CommonProps, 'variant' | 'take' | 'icon' | 'children'>) {
  const content = (
    <>
      {icon}
      <span>{children}</span>
      {take ? <span className="gl-btn__take">{take}</span> : null}
    </>
  );
  if (variant === 'slate') {
    return (
      <>
        <span className="gl-btn__stick" aria-hidden="true" />
        <span className="gl-btn__board">{content}</span>
      </>
    );
  }
  return content;
}

export type ButtonProps = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & { ref?: Ref<HTMLButtonElement> };

/** Button. `variant="slate"` is the primary CTA, shaped like a clapperboard. */
export function Button({
  variant = 'outline',
  size = 'md',
  block = false,
  take,
  icon,
  className,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={cx(buttonClass(variant, size, block), className)} {...rest}>
      <Inner variant={variant} take={take} icon={icon}>
        {children}
      </Inner>
    </button>
  );
}

export type ButtonLinkProps = CommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children' | 'href'> & { href: string };

/** A link styled as a Button (next/link). */
export function ButtonLink({
  variant = 'outline',
  size = 'md',
  block = false,
  take,
  icon,
  className,
  href,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link href={href} className={cx(buttonClass(variant, size, block), className)} {...rest}>
      <Inner variant={variant} take={take} icon={icon}>
        {children}
      </Inner>
    </Link>
  );
}
