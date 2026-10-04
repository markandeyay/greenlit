'use client';
// Compact play-screen header (design brief v2): the mode name, a one-line goal, and a small
// "How to play" button that opens the rules in a dialog. Nothing decorative above the game.
import { useState, type ReactNode } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { IconHelp } from '@/components/ui/icons';

export interface ModeHeaderProps {
  title: string;
  goal: ReactNode;
  /** Rules shown in the How to play dialog: short items, one idea each. */
  rules: ReactNode[];
}

export function ModeHeader({ title, goal, rules }: ModeHeaderProps) {
  const [open, setOpen] = useState(false);
  return (
    <header className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="ty-display text-[34px] sm:text-[44px]">{title}</h1>
        <p className="mt-1.5 text-[15px] leading-snug text-ink-dim sm:text-base">{goal}</p>
      </div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-rule bg-surface px-3 text-sm font-semibold text-ink hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        aria-haspopup="dialog"
      >
        <IconHelp aria-hidden="true" width={18} height={18} />
        <span>How to play</span>
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`How to play ${title}`}
        bar={title}
        actions={
          <Button variant="slate" onClick={() => setOpen(false)}>
            Got it
          </Button>
        }
      >
        <ol className="flex flex-col gap-3">
          {rules.map((r, i) => (
            <li key={i} className="flex gap-3 text-base leading-snug">
              <span aria-hidden="true" className="ty-num grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-bold">
                {i + 1}
              </span>
              <span>{r}</span>
            </li>
          ))}
        </ol>
      </Dialog>
    </header>
  );
}
