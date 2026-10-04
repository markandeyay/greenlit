'use client';
// Compact mode header (design brief v2): mode name, one-line goal and a small "How to play" sheet.
// Rules live in the sheet so the play area starts right under the header on a phone.
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { IconHelp } from '@/components/ui/icons';
import { cx } from '@/components/ui/cx';

export function HowToPlay({ title, rules, className }: { title: string; rules: ReactNode[]; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        icon={<IconHelp width={18} height={18} />}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={cx('shrink-0', className)}
        data-testid="how-to-play"
      >
        How to play
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={title} bar="How to play">
        <ul className="m-0 flex list-disc flex-col gap-2 pl-5 text-[16px] leading-snug">
          {rules.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </Dialog>
    </>
  );
}

export function ModeHeader({
  name,
  goal,
  rules,
  as: As = 'h1',
  className,
}: {
  name: ReactNode;
  goal: ReactNode;
  rules: ReactNode[];
  as?: 'h1' | 'h2';
  className?: string;
}) {
  return (
    <header className={className} data-testid="mode-header">
      <div className="flex items-center justify-between gap-3">
        <As className="ty-display m-0 min-w-0 text-[clamp(28px,7.5vw,44px)] leading-[0.95]">{name}</As>
        <HowToPlay title={typeof name === 'string' ? `How to play ${name}` : 'How to play'} rules={rules} />
      </div>
      <p className="m-0 mt-1 text-[16px] leading-snug text-ink-dim">{goal}</p>
    </header>
  );
}
