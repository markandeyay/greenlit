'use client';

import { useState } from 'react';
import { COPY } from '@/config/brand';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Dialog';

/** "Walk away" (Section 4.1): give up after a confirm dialog. Focus starts on the safe choice. */
export function GiveUp({
  onConfirm,
  disabled = false,
  take,
  maxGuesses,
}: {
  onConfirm: () => void;
  disabled?: boolean;
  take: number;
  maxGuesses: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="sm" disabled={disabled} onClick={() => setOpen(true)} aria-haspopup="dialog">
        {COPY.giveUp}
      </Button>
      <ConfirmDialog
        open={open}
        tone="danger"
        title="Walk away from this reel?"
        description={`You are on take ${take} of ${maxGuesses}. Walking away reveals the film and sends this reel to turnaround. There is no reshoot.`}
        confirmLabel={COPY.giveUp}
        cancelLabel="Keep rolling"
        bar={COPY.takeLabel(take, maxGuesses)}
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false);
          onConfirm();
        }}
      />
    </>
  );
}
