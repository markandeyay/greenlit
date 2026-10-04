'use client';
// The sortable list (WS9 Release Order). Drag a film by its grip (pointer events: mouse, pen and
// touch) or use the Move up / Move down buttons (keyboard and assistive tech). Each move is
// announced in a polite live region. No dnd library: the list reorders live as the pointer
// crosses a neighbour's midpoint.
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Poster } from '@/components/game/Poster';
import { cx, IconArrow, IconButton, StatusGlyph } from '@/components/ui';
import type { ReleaseOrderAttempt, ReleaseOrderCard, SlotVerdict } from '@/server/modes/release-order/types';

const VERDICT_WORDS: Record<SlotVerdict, string> = { match: 'right slot', close: 'one slot off', miss: 'wrong slot' };

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
      <ol ref={listRef} className="m-0 flex list-none flex-col gap-2 p-0" aria-label="Your order, earliest first">
        {order.map((key, i) => {
          const card = byKey.get(key);
          if (!card) return null;
          const lastPos = lastAttempt ? lastAttempt.order.indexOf(key) : -1;
          const lastVerdict = lastPos >= 0 ? lastAttempt!.feedback[lastPos]! : null;
          return (
            <li
              key={key}
              data-ro-item=""
              data-key={key}
              data-testid="ro-item"
              className={cx(
                'flex items-center gap-2 border-[1.5px] bg-surface p-2 sm:gap-3',
                dragging === key ? 'border-ink' : 'border-rule',
              )}
            >
              <span className="ty-label w-6 shrink-0 text-center tabular-nums" aria-hidden="true">
                {i + 1}
              </span>
              <span
                aria-hidden="true"
                data-testid="ro-grip"
                onPointerDown={(e) => onPointerDown(e, key)}
                className={cx(
                  'grid h-11 w-6 shrink-0 touch-none select-none place-items-center text-ink-dim',
                  disabled ? 'cursor-default opacity-40' : 'cursor-grab active:cursor-grabbing',
                )}
              >
                <GripIcon />
              </span>
              <Poster title={card.title} posterPath={card.posterPath} size="xs" />
              <div className="min-w-0 flex-1">
                <p className="m-0 font-semibold leading-tight [overflow-wrap:anywhere]" data-testid="ro-title">
                  <span className="sr-only">Position {i + 1}: </span>
                  {card.title}
                </p>
                {lastVerdict ? (
                  <p className="m-0 mt-1">
                    <span
                      className="gl-status inline-flex items-center gap-1 rounded-[3px] border px-1.5 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wide"
                      data-verdict={lastVerdict}
                    >
                      <StatusGlyph verdict={lastVerdict} className="!text-[12px]" />
                      Last take: slot {lastPos + 1}, {VERDICT_WORDS[lastVerdict]}
                    </span>
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-col sm:flex-row">
                <IconButton
                  size="sm"
                  outline
                  label={`Move ${card.title} up`}
                  data-key={key}
                  data-move="up"
                  disabled={disabled || i === 0}
                  onClick={() => step(key, 'up')}
                  icon={<IconArrow className="-rotate-90" />}
                  className="disabled:opacity-30"
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
                  className="disabled:opacity-30"
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
