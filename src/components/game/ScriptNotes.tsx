'use client';

import { useEffect, useId, useRef, useState } from 'react';
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
  className?: string;
}

/**
 * Script Notes (Section 4.8): Note 1 unlocks after take RULES.hintUnlockAfter[0], Note 2 after
 * [1] (pitches: one creator's note after PITCH.noteUnlockAfter). The player picks a remaining
 * candidate by its type label without seeing it, then reveals it. Used notes stay on the page and
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
  className,
}: ScriptNotesProps) {
  const headingId = useId();
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
  const usedCount = hints.length;

  return (
    <section aria-labelledby={headingId} className={cx('border border-rule bg-surface', className)}>
      <header className="flex items-center justify-between gap-3 border-b border-rule px-4 py-2.5">
        <h2 id={headingId} className="flex items-center gap-2 font-mono text-[13px] font-bold tracking-[0.08em] uppercase">
          <span aria-hidden="true">📝</span>
          {COPY.hintsName}
        </h2>
        <span className="font-mono text-[12px] font-bold tracking-widest text-ink-dim uppercase tabular-nums">
          {usedCount} / {slots.length} used
        </span>
      </header>
      <ol className="divide-y divide-rule">
        {slots.map((slot) => (
          <li key={slot} className="px-4 py-3">
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
        <p className="mb-2 font-mono text-[12px] font-bold tracking-widest text-ink-dim uppercase">{name}</p>
        <div ref={pageRef} tabIndex={-1} className="gm-note-page" data-new={fresh || undefined}>
          <HintContent hint={used.hint} />
        </div>
      </div>
    );
  }

  const head = (right: string) => (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <p className="font-mono text-[12px] font-bold tracking-widest uppercase">{name}</p>
      <p className="font-mono text-[12px] text-ink-dim">{right}</p>
    </div>
  );

  if (!inProgress) {
    return head("Not used");
  }

  if (take < threshold) {
    const left = threshold - take;
    return (
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1">{head(`Unlocks after take ${threshold}`)}</div>
        <span className="sr-only">{plural(left, 'more take')} to go.</span>
      </div>
    );
  }

  if (slot === 2 && !slot1Used) {
    return head(`Open Note 1 first`);
  }

  if (options === null) {
    return head("Pulling notes from the writers room...");
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
      {head("Unlocked")}
      <p id={`${groupId}-d`} className="mt-1 text-[14px] text-ink-dim">
        Pick a note by its type. You will not see what it says until you reveal it.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((t) => (
          <label key={t} className="gm-note-choice">
            <input
              type="radio"
              name={`${groupId}-choice`}
              value={t}
              checked={choice === t}
              onChange={() => setChoice(t)}
            />
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
