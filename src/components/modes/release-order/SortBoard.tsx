'use client';
// The sortable list (WS9 Release Order). Drag a film by its grip (pointer events: mouse, pen and
// touch) or use the Move up / Move down buttons (keyboard and assistive tech). Each move is
// announced in a polite live region. No dnd library: the list reorders live as the pointer
// crosses a neighbour's midpoint.
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Poster } from '@/components/game/Poster';
import { cx, IconArrow, IconButton } from '@/components/ui';
import type { ReleaseOrderAttempt, ReleaseOrderCard, SlotVerdict } from '@/server/modes/release-order/types';

export const SLOT_GLYPH: Record<SlotVerdict, string> = { match: '✓', close: '≈', miss: '✗' };
export const SLOT_WORD: Record<SlotVerdict, string> = { match: 'Right spot', close: 'One off', miss: 'Wrong spot' };

export function moveKey(order: readonly number[], key: number, to: number): number[] {
  const rest = order.filter((k) => k !== key);
  const at = Math.max(0, Math.min(rest.length, to));
  return [...rest.slice(0, at), key, ...rest.slice(at)];
}

function GripIcon() {
  return (
    <svg viewBox="0 0 12 20" width="12" height="20" aria-hidden="true" fill="currentColor">
      {[3, 10, 17].map((y) => (
        <g key={y}>
          <circle cx="3" cy={y} r="1.6" />
          <circle cx="9" cy={y} r="1.6" />
        </g>
      ))}
    </svg>
  );
}

export function SortBoard({
  cards,
  order,
  onChange,
  lastAttempt,
  disabled = false,
}: {
  cards: ReleaseOrderCard[];
  order: number[];
  onChange: (next: number[]) => void;
  lastAttempt: ReleaseOrderAttempt | null;
  disabled?: boolean;
}) {
  const byKey = new Map(cards.map((c) => [c.key, c]));
  const listRef = useRef<HTMLOListElement>(null);
  const drag = useRef<{ key: number; pointerId: number } | null>(null);
  const pendingFocus = useRef<{ key: number; dir: 'up' | 'down' } | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const n = order.length;

  const announce = (key: number, next: number[]) => {
    const title = byKey.get(key)?.title ?? 'Film';
    setAnnouncement(`${title} moved to position ${next.indexOf(key) + 1} of ${n}.`);
  };

  // Keep focus on the moved film's buttons after a keyboard move.
  useEffect(() => {
    const p = pendingFocus.current;
    if (!p || !listRef.current) return;
    pendingFocus.current = null;
    const want = listRef.current.querySelector<HTMLButtonElement>(`button[data-key="${p.key}"][data-move="${p.dir}"]`);
    const other = listRef.current.querySelector<HTMLButtonElement>(
      `button[data-key="${p.key}"][data-move="${p.dir === 'up' ? 'down' : 'up'}"]`,
    );
    (want && !want.disabled ? want : other)?.focus();
  }, [order]);

  const step = (key: number, dir: 'up' | 'down') => {
    const at = order.indexOf(key);
    const to = dir === 'up' ? at - 1 : at + 1;
    if (to < 0 || to >= n) return;
    const next = moveKey(order, key, to);
    pendingFocus.current = { key, dir };
    onChange(next);
    announce(key, next);
  };

  // Latest props for the window level drag listeners (the list re-renders while dragging).
  const latest = useRef({ order, onChange, announce });
  useLayoutEffect(() => {
    latest.current = { order, onChange, announce };
  });
  const stopDrag = useRef<(() => void) | null>(null);
  useEffect(() => () => stopDrag.current?.(), []);

  // Listeners live on window, not the grip: reordering moves the grip's DOM node, which would
  // drop pointer capture mid drag.
  const onPointerDown = (e: ReactPointerEvent<HTMLElement>, key: number) => {
    if (disabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    stopDrag.current?.();
    const pointerId = e.pointerId;
    drag.current = { key, pointerId };
    setDragging(key);

    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId || !listRef.current) return;
      ev.preventDefault();
      const items = Array.from(listRef.current.querySelectorAll<HTMLElement>('[data-ro-item]')).filter(
        (el) => Number(el.dataset.key) !== key,
      );
      const to = items.filter((el) => {
        const r = el.getBoundingClientRect();
        return r.top + r.height / 2 < ev.clientY;
      }).length;
      const cur = latest.current.order;
      if (cur.indexOf(key) === to) return;
      const next = moveKey(cur, key, to);
      latest.current.order = next;
      latest.current.onChange(next);
    };
    const end = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      cleanup();
      latest.current.announce(key, latest.current.order);
    };
    const cleanup = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      drag.current = null;
      stopDrag.current = null;
      setDragging(null);
    };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    stopDrag.current = cleanup;
  };

  return (
    <div>
      <ol ref={listRef} className="m-0 flex list-none flex-col gap-2 p-0" aria-label="Your order, oldest first">
        {order.map((key, i) => {
          const card = byKey.get(key);
          if (!card) return null;
          const lastPos = lastAttempt ? lastAttempt.order.indexOf(key) : -1;
          const lastVerdict = lastPos >= 0 ? lastAttempt!.feedback[lastPos]! : null;
          // A chip describes the slot the film sat in on the last take, so it only shows while the
          // film is still in that slot (otherwise it would describe a different position).
          const chip = lastVerdict && lastPos === i ? lastVerdict : null;
          return (
            <li
              key={key}
              data-ro-item=""
              data-key={key}
              data-testid="ro-item"
              className={cx(
                'flex min-h-[64px] items-center gap-1.5 rounded-[6px] border-2 bg-surface py-1 pr-1 pl-0.5 sm:gap-3 sm:pr-2',
                dragging === key ? 'border-ink shadow-md' : 'border-rule',
              )}
            >
              <span
                aria-hidden="true"
                data-testid="ro-grip"
                onPointerDown={(e) => onPointerDown(e, key)}
                className={cx(
                  'grid h-14 w-10 shrink-0 touch-none select-none place-items-center rounded-[4px] text-ink-dim',
                  disabled ? 'cursor-default opacity-40' : 'cursor-grab hover:bg-surface-2 active:cursor-grabbing',
                )}
              >
                <GripIcon />
              </span>
              <span className="ty-num w-5 shrink-0 text-center font-mono text-[15px] font-bold" aria-hidden="true">
                {i + 1}
              </span>
              <Poster title={card.title} posterPath={card.posterPath} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="m-0 line-clamp-2 text-[15px] leading-tight font-semibold [overflow-wrap:anywhere]" data-testid="ro-title">
                  <span className="sr-only">Position {i + 1}: </span>
                  {card.title}
                </p>
                {chip ? (
                  <p className="m-0 mt-1">
                    <span
                      className="gl-status inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] font-bold"
                      data-verdict={chip}
                      data-testid="ro-chip"
                    >
                      <span aria-hidden="true">{SLOT_GLYPH[chip]}</span>
                      <span className="sr-only">Last take: </span>
                      {SLOT_WORD[chip]}
                    </span>
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-col gap-0.5">
                <IconButton
                  size="sm"
                  outline
                  label={`Move ${card.title} up`}
                  data-key={key}
                  data-move="up"
                  disabled={disabled || i === 0}
                  onClick={() => step(key, 'up')}
                  icon={<IconArrow className="-rotate-90" />}
                  className="!h-10 !w-11 disabled:opacity-30"
                />
                <IconButton
                  size="sm"
                  outline
                  label={`Move ${card.title} down`}
                  data-key={key}
                  data-move="down"
                  disabled={disabled || i === n - 1}
                  onClick={() => step(key, 'down')}
                  icon={<IconArrow className="rotate-90" />}
                  className="!h-10 !w-11 disabled:opacity-30"
                />
              </div>
            </li>
          );
        })}
      </ol>
      <p className="sr-only" aria-live="polite" data-testid="ro-announce">
        {announcement}
      </p>
    </div>
  );
}
