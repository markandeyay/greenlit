'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { APP_NAME } from '@/config/brand';
import { ButtonLink } from '@/components/ui/Button';
import { IconLink } from '@/components/ui/IconButton';
import { IconClose, IconHelp, IconMenu, IconSettings, IconStats } from '@/components/ui/icons';
import { LeaderStrip } from './LeaderStrip';
import { NAV_PITCH, NAV_PRIMARY, NAV_UTILITY, isActivePath } from './nav-items';
import { RecDot } from './RecDot';
import { ReelCode } from './ReelCode';
import { TimecodeClock } from './TimecodeClock';

const UTILITY_ICONS: Record<string, typeof IconHelp> = {
  '/how-to-play': IconHelp,
  '/stats': IconStats,
  '/settings': IconSettings,
};

/**
 * The top bar (Section 3), styled as one line of camera OSD like the SFA header: REC, the
 * wordmark, the reel list as edge print, the timecode countdown, utility icons, and the
 * slate-shaped Pitch button. Below 1024px the links move into an accessible disclosure menu.
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
    <header className="gl-header" onKeyDown={onKeyDown}>
      <LeaderStrip
        kind="head"
        right={
          <>
            <span className="gl-strip__hide-sm">Picture start · 24 fps · 2.39 : 1 ·</span>
            <ReelCode />
          </>
        }
      />
      <div className="gl-nav">
        <Link href="/" className="gl-nav__mark" aria-label={`${APP_NAME}, today's reel`}>
          <RecDot />
          <span className="gl-nav__word">{APP_NAME}</span>
        </Link>

        <nav aria-label="Main" className="gl-nav__links">
          {NAV_PRIMARY.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="gl-nav__link"
                aria-current={active ? 'page' : undefined}
              >
                <span className="gl-nav__tick" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="gl-nav__meta">
          <TimecodeClock className="gl-nav__tc" />
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
            className="gl-icon-btn gl-icon-btn--outline gl-nav__burger"
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
            {NAV_PRIMARY.map((item, i) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="gl-menu__link"
                  aria-current={isActivePath(pathname, item.href) ? 'page' : undefined}
                  onClick={() => close(false)}
                >
                  <span className="gl-menu__n" aria-hidden="true">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {item.label}
                </Link>
              </li>
            ))}
            {NAV_UTILITY.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="gl-menu__link gl-menu__link--sm"
                  aria-current={isActivePath(pathname, item.href) ? 'page' : undefined}
                  onClick={() => close(false)}
                >
                  <span className="gl-menu__n" aria-hidden="true">
                    ▸
                  </span>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="gl-menu__foot">
          <ButtonLink href={NAV_PITCH.href} variant="slate" onClick={() => close(false)}>
            {NAV_PITCH.label}
          </ButtonLink>
          {open ? <TimecodeClock /> : null}
        </div>
      </div>
    </header>
  );
}
