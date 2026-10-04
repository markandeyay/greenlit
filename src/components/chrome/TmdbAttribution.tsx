import { TMDB_ATTRIBUTION } from '@/config/brand';
import { cx } from '@/components/ui/cx';

export const TMDB_URL = 'https://www.themoviedb.org/';

/**
 * TMDB mark (Section 15). A text wordmark in TMDB's brand colors, linking to TMDB, kept less
 * prominent than our own wordmark as their guidelines ask. Replace the inner wordmark with the
 * official logo SVG (public/brand/tmdb.svg) once it is downloaded from TMDB's logo page.
 */
export function TmdbMark({ className }: { className?: string }) {
  return (
    <a href={TMDB_URL} rel="noreferrer" target="_blank" className={cx('gl-tmdb', className)}>
      <span className="gl-tmdb__word" aria-hidden="true">
        TMDB
      </span>
      <span className="sr-only">The Movie Database (TMDB), opens in a new tab</span>
    </a>
  );
}

/** Mark plus the required attribution sentence. Use in the footer and on How to play. */
export function TmdbAttribution({ className }: { className?: string }) {
  return (
    <div className={cx('gl-footer__tmdb', className)}>
      <TmdbMark />
      <p>{TMDB_ATTRIBUTION}</p>
    </div>
  );
}
