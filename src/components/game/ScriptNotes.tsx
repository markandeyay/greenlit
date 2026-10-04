'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { COPY } from '@/config/brand';
import { HINT_TYPE_LABELS } from '@/config/hints';
import { Button } from '@/components/ui/Button';
import { cx } from '@/components/ui/cx';
import { gameApi, type Target } from '@/lib/game/api';
import { noteSlots, noteThreshold } from '@/lib/game/state';
import { plural } from '@/lib/format';
import type { HintOptionsResponse, HintSlot, HintType, PlayStatus, UsedHint } from '@/lib/types';
import { HintContent } from './HintContent';

export interface ScriptNotesProps {
  target: Target;
  take: number;
  status: PlayStatus;
  hints: UsedHint[];
  /** Reveal a note. Resolves true on success. */
  onReveal: (slot: HintSlot, type: HintType) => Promise<boolean>;
  /** Slots revealed during this page view (animate in). */
  freshSlots?: ReadonlySet<HintSlot>;
  loadOptions?: (t: Target) => Promise<HintOptionsResponse>;
  /** Extra controls on the right of the notes line (e.g. takes left and Walk away). */
  aside?: ReactNode;
  className?: string;
}

/** "Script Notes", shortened to "Notes" on phones (the full name stays in the accessible name). */
function ChipName() {
  const words = COPY.hintsName.split(' ');
  const short = words[words.length - 1] ?? COPY.hintsName;
  return (
    <span className="font-bold">
      <span className="sr-only">{COPY.hintsName}</span>
      <span aria-hidden="true" className="sm:hidden">
        {short}
      </span>
      <span aria-hidden="true" className="max-sm:hidden">
        {COPY.hintsName}
      </span>
    </span>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" className="flex-none">
      <rect x="3" y="7" width="10" height="7" rx="1.5" fill="currentColor" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

/**
 * Script Notes (Section 4.8) as a quiet control: a small chip that says when the next note
 * unlocks, and expands into the note picker only once a note is available (it opens by itself
 * the moment one unlocks). Note 1 unlocks after take RULES.hintUnlockAfter[0], Note 2 after [1]
 * (pitches: one creator's note after PITCH.noteUnlockAfter). The player picks a remaining
 * candidate by its type label without seeing it, then reveals it. Used notes stay readable and
 * flag the share with a 📝.
 */
export function ScriptNotes({
  target,
  take,
  status,
  hints,
  onReveal,
  freshSlots,
  loadOptions = gameApi.hintOptions,
  aside,
  className,
}: ScriptNotesProps) {
  const headingId = useId();
  const panelId = useId();
  const { kind, ref } = target;
  const slots = noteSlots(target.kind);
  const used = new Map(hints.map((h) => [h.slot, h]));
  const inProgress = status === 'in_progress';
  const [options, setOptions] = useState<HintOptionsResponse | null>(null);
  const [optionsKey, setOptionsKey] = useState('');

  const unlockedUnused = slots.filter((s) => {
    const t = noteThreshold(target.kind, s);
    return t !== null && take >= t && !used.has(s);
  });
  const ready = inProgress ? unlockedUnused.length : 0;
  const nextLocked = inProgress
    ? slots
        .filter((s) => !used.has(s))
        .map((s) => noteThreshold(target.kind, s))
        .filter((t): t is number => t !== null && take < t)
        .sort((a, b) => a - b)[0] ?? null
    : null;
  const usedCount = hints.length;
  const expandable = ready > 0 || usedCount > 0;

  // Open by itself whenever a new note becomes available (derived during render, no effect).
  const readyKey = ready > 0 ? unlockedUnused.join(',') : '';
  const [open, setOpen] = useState(ready > 0);
  const [seenReadyKey, setSeenReadyKey] = useState(readyKey);
  if (readyKey !== seenReadyKey) {
    setSeenReadyKey(readyKey);
    if (readyKey) setOpen(true);
  }

  const wantKey = inProgress && unlockedUnused.length ? `${target.kind}:${target.ref}:${take}:${hints.length}` : '';

  useEffect(() => {
    if (!wantKey) return;
    let live = true;
    loadOptions({ kind, ref })
      .then((o) => {
        if (!live) return;
        setOptions(o);
        setOptionsKey(wantKey);
      })
      .catch(() => {
        if (!live) return;
        setOptions({ slot1: [], slot2: [] });
        setOptionsKey(wantKey);
      });
    return () => {
      live = false;
    };
  }, [wantKey, loadOptions, kind, ref]);

  const current = optionsKey === wantKey ? options : null;
  const isOpen = expandable && open;

  const statusBits = (
    <>
      {ready > 0 ? (
        <span className="gm-notes__ready">{ready === 1 ? '1 note ready' : `${ready} notes ready`}</span>
      ) : null}
      {usedCount > 0 ? (
        <span className="tabular-nums">
          {usedCount} / {slots.length} used
        </span>
      ) : null}
      {ready === 0 && nextLocked !== null ? (
        <span className="inline-flex items-center gap-1">
          <LockIcon />
          <span>Unlocks after take {nextLocked}</span>
        </span>
      ) : null}
    </>
  );

  return (
    <section aria-labelledby={headingId} className={cx('gm-notes', className)} data-open={isOpen || undefined}>
      <div className="flex min-h-[44px] flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 id={headingId} className="m-0 min-w-0">
          {expandable ? (
            <button
              type="button"
              className="gm-notes__chip"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => setOpen(!isOpen)}
            >
              <span aria-hidden="true">📝</span>
              <ChipName />
              <span className="gm-notes__status">{statusBits}</span>
              <span aria-hidden="true" className={cx('inline-block motion-safe:transition-transform', isOpen && 'rotate-180')}>
                ▾
              </span>
            </button>
          ) : (
            <span className="gm-notes__chip" data-locked="true">
              <span aria-hidden="true">📝</span>
              <ChipName />
              <span className="gm-notes__status">{statusBits}</span>
            </span>
          )}
        </h2>
        {aside ? <div className="ml-auto flex items-center gap-3">{aside}</div> : null}
      </div>
      {expandable ? (
        <div id={panelId} hidden={!isOpen} className="gm-notes__panel">
          <ol className="divide-y divide-rule">
            {slots.map((slot) => (
              <li key={slot} className="py-3 first:pt-2 last:pb-1">
                <NoteSlot
                  slot={slot}
                  kind={target.kind}
                  take={take}
                  inProgress={inProgress}
                  used={used.get(slot) ?? null}
                  slot1Used={used.has(1)}
                  options={current ? (slot === 1 ? current.slot1 : current.slot2) : null}
                  onReveal={onReveal}
                  fresh={freshSlots?.has(slot) ?? false}
                />
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}

function NoteSlot({
  slot,
  kind,
  take,
  inProgress,
  used,
  slot1Used,
  options,
  onReveal,
  fresh,
}: {
  slot: HintSlot;
  kind: Target['kind'];
  take: number;
  inProgress: boolean;
  used: UsedHint | null;
  slot1Used: boolean;
  options: HintType[] | null;
  onReveal: (slot: HintSlot, type: HintType) => Promise<boolean>;
  fresh: boolean;
}) {
  const name = `Note ${slot}`;
  const threshold = noteThreshold(kind, slot) ?? Infinity;
  const [choice, setChoice] = useState<HintType | null>(null);
  const [revealing, setRevealing] = useState(false);
  const groupId = useId();
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (fresh) pageRef.current?.focus();
  }, [fresh]);

  if (used) {
    return (
      <div>
        <p className="mb-2 text-[13px] font-bold text-ink-dim">{name}</p>
        <div ref={pageRef} tabIndex={-1} className="gm-note-page" data-new={fresh || undefined}>
          <HintContent hint={used.hint} />
        </div>
      </div>
    );
  }

  const head = (right: string) => (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-[14px]">
      <p className="font-bold">{name}</p>
      <p className="text-ink-dim">{right}</p>
    </div>
  );

  if (!inProgress) {
    return head('Not used');
  }

  if (take < threshold) {
    const left = threshold - take;
    return (
      <div>
        {head(`Unlocks after take ${threshold}`)}
        <span className="sr-only">{plural(left, 'more take')} to go.</span>
      </div>
    );
  }

  if (slot === 2 && !slot1Used) {
    return head('Open Note 1 first');
  }

  if (options === null) {
    return head('Pulling notes from the writers room...');
  }

  if (options.length === 0) {
    return head(kind === 'pitch' ? 'No note came with this pitch' : 'No notes left for this slot');
  }

  const submit = async () => {
    if (!choice || revealing) return;
    setRevealing(true);
    const ok = await onReveal(slot, choice);
    if (!ok) setRevealing(false);
  };

  return (
    <fieldset aria-describedby={`${groupId}-d`}>
      <legend className="sr-only">{name}: choose a note</legend>
      {head('Unlocked')}
      <p id={`${groupId}-d`} className="mt-1 text-[14px] text-ink-dim">
        Pick a type. You see the note only after you reveal it.
      </p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {options.map((t) => (
          <label key={t} className="gm-note-choice">
            <input type="radio" name={`${groupId}-choice`} value={t} checked={choice === t} onChange={() => setChoice(t)} />
            <span>{HINT_TYPE_LABELS[t]}</span>
          </label>
        ))}
      </div>
      <div className="mt-3">
        <Button variant="solid" size="sm" disabled={!choice || revealing} onClick={submit}>
          {revealing ? 'Revealing...' : `Reveal ${name.toLowerCase()}`}
        </Button>
      </div>
    </fieldset>
  );
}
