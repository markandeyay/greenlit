'use client';

import Link from 'next/link';
import { useRef } from 'react';
import { RULES } from '@/config/rules';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Dialog } from '@/components/ui/Dialog';
import { StatusCell } from '@/components/ui/StatusCell';
import { StatusGlyph } from '@/components/ui/StatusGlyph';
import { cellAriaLabel } from '@/components/ui/status';

/**
 * The first-visit "How to play" bottom sheet (design brief v2): one sentence of rules, a single
 * example row, and the color legend. Shown once (see lib/game/howto), reopenable from the help
 * button. Rendered with the Dialog primitive, so focus, Escape and the scroll lock come for free.
 */
export function HowToPlaySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const startRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="How to play"
      bar="Quick rules"
      className="gm-howto"
      initialFocusRef={startRef}
      description={`Guess the mystery movie in ${RULES.maxGuesses} tries. Every guess shows how close it is.`}
      actions={
        <Button ref={startRef} variant="solid" block onClick={onClose}>
          Start playing
        </Button>
      }
    >
      <p className="ty-micro text-ink-dim">Example guess</p>
      <div className="mt-2 grid grid-cols-3 gap-1.5" role="group" aria-label="Example guess">
        <StatusCell
          verdict="match"
          label="Director"
          value="Nolan"
          className="gm-howto__cell"
          ariaLabel={cellAriaLabel({ label: 'Director', value: 'Nolan', verdict: 'match' })}
        />
        <StatusCell
          verdict="close"
          label="Year"
          value="2006"
          direction="LATER"
          className="gm-howto__cell"
          ariaLabel={cellAriaLabel({ label: 'Year', value: '2006', verdict: 'close', direction: 'LATER' })}
        />
        <StatusCell
          verdict="miss"
          label="Studio"
          value="A24"
          className="gm-howto__cell"
          ariaLabel={cellAriaLabel({ label: 'Studio', value: 'A24', verdict: 'miss' })}
        />
      </div>

      <ul className="mt-4 grid gap-2.5 text-[15px] leading-snug">
        <li className="flex items-center gap-3">
          <span className="gm-howto__swatch gl-status" data-verdict="match">
            <StatusGlyph verdict="match" />
          </span>
          <span>
            <b>Green</b> is a match.
          </span>
        </li>
        <li className="flex items-center gap-3">
          <span className="gm-howto__swatch gl-status" data-verdict="close">
            <StatusGlyph verdict="close" />
          </span>
          <span>
            <b>Yellow</b> is close (a year within {RULES.yearClose}, say).
          </span>
        </li>
        <li className="flex items-center gap-3">
          <span className="gm-howto__swatch gl-status" data-verdict="miss" />
          <span>
            <b>Gray</b> is a miss.
          </span>
        </li>
        <li className="flex items-center gap-3">
          <span className="gm-howto__word" aria-hidden="true">
            LATER
          </span>
          <span>Words like LATER or EARLIER point toward the answer.</span>
        </li>
        <li className="flex items-center gap-3">
          <Chip status="match">
            Drama<span className="sr-only">, match</span>
          </Chip>
          <span>Genres light up one by one.</span>
        </li>
      </ul>
      <p className="mt-4 text-[14px] text-ink-dim">
        Stuck? Script Notes unlock after take {RULES.hintUnlockAfter[0]}.{' '}
        <Link href="/how-to-play" className="underline underline-offset-2 hover:text-ink">
          Full rules
        </Link>
      </p>
    </Dialog>
  );
}
