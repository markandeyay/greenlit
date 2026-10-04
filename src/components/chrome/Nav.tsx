'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { APP_NAME } from '@/config/brand';
import { ButtonLink } from '@/components/ui/Button';
import { IconLink } from '@/components/ui/IconButton';
import { IconArrow, IconClose, IconHelp, IconMenu, IconSettings, IconStats } from '@/components/ui/icons';
import { NAV_PITCH, NAV_PRIMARY, NAV_UTILITY, isActivePath } from './nav-items';
import { RecDot } from './RecDot';
import { TimecodeClock } from './TimecodeClock';

const UTILITY_ICONS: Record<string, typeof IconHelp> = {
  '/how-to-play': IconHelp,
  '/stats': IconStats,
  '/settings': IconSettings,
};

/**
 * The top bar (Section 3), one slim 56px row: the wordmark, the primary routes (Today and Modes
 * from tablet width, all four on desktop), the countdown to the next reel (desktop only), icon
 * links for How to play, Stats and Settings at every width, and the slate Pitch button on
 * desktop. Below 1024px the routes and the Pitch button live in a full-height menu sheet.
 */
export function Nav() {
  const pathname = usePathname();
  // The menu is open for the path it was opened on, so navigating closes it without an effect.
  const [openFor, setOpenFor] = useState<string | null>(null);
  const open = openFor !== null && openFor === pathname;
  const menuId = useId();
  const burgerRef = useRef<HTMLButtonElement>(null);

  const close = (refocus: boolean) => {
    setOpenFor(null);
    if (refocus) burgerRef.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape' && open) {
      e.stopPropagation();
      close(true);
    }
  };

  return (
    <header className="gl-header" data-menu-open={open || undefined} onKeyDown={onKeyDown}>
      <div className="gl-nav">
        <Link href="/" className="gl-nav__mark" aria-label={`${APP_NAME}, today's reel`}>
          <RecDot />
          <span className="gl-nav__word">{APP_NAME}</span>
        </Link>

        <nav aria-label="Main" className="gl-nav__links">
          {NAV_PRIMARY.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="gl-nav__link"
              data-tier={item.tier}
              aria-current={isActivePath(pathname, item.href) ? 'page' : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="gl-nav__meta">
          <TimecodeClock prefix="Next reel" className="gl-nav__tc" />
          <div className="gl-nav__icons">
            {NAV_UTILITY.map((item) => {
              const Icon = UTILITY_ICONS[item.href] ?? IconHelp;
              return (
                <IconLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={<Icon />}
                  aria-current={isActivePath(pathname, item.href) ? 'page' : undefined}
                />
              );
            })}
          </div>
          <ButtonLink
            href={NAV_PITCH.href}
            variant="slate"
            size="sm"
            className="gl-nav__pitch"
            aria-current={isActivePath(pathname, NAV_PITCH.href) ? 'page' : undefined}
          >
            {NAV_PITCH.label}
          </ButtonLink>
          <button
            ref={burgerRef}
            type="button"
            className="gl-icon-btn gl-nav__burger"
            aria-expanded={open}
            aria-controls={menuId}
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => (open ? close(false) : setOpenFor(pathname))}
          >
            {open ? <IconClose /> : <IconMenu />}
          </button>
        </div>
      </div>

      <div id={menuId} className="gl-menu" hidden={!open}>
        <nav aria-label="Main menu">
          <ul className="gl-menu__list">
            {NAV_PRIMARY.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="gl-menu__link"
                  aria-current={isActivePath(pathname, item.href) ? 'page' : undefined}
                  onClick={() => close(false)}
                >
                  <span>{item.label}</span>
                  <IconArrow className="gl-menu__chev" />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="gl-menu__foot">
          <ButtonLink href={NAV_PITCH.href} variant="slate" size="lg" block onClick={() => close(false)}>
            {NAV_PITCH.label}
          </ButtonLink>
          {open ? <TimecodeClock prefix="Next reel in" className="gl-menu__tc" /> : null}
        </div>
      </div>
    </header>
  );
}
