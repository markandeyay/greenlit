'use client';
import { useEffect, useRef, useState } from 'react';
import { nextResetAt } from '@/lib/dates';
import { usePrefersReducedMotion } from '@/lib/settings';
import { cx } from '@/components/ui/cx';
import { useIsClient } from '@/components/ui/useIsClient';
import { describeRemaining, formatTimecode } from './timecode';

export interface TimecodeClockProps {
  /** Visible prefix. */
  prefix?: string;
  /** Spoken lead-in for the accessible label. */
  label?: string;
  size?: 'md' | 'lg';
  /** Called when the countdown passes the daily reset (a new reel is live). */
  onReset?: () => void;
  className?: string;
}

const PLACEHOLDER = '--:--:--:--';

/**
 * Countdown to the next daily reset (00:00 America/New_York) as `TC HH:MM:SS:FF` at 24 fps.
 * Renders a fixed-width placeholder until mounted (no hydration mismatch), ticks once per frame
 * with requestAnimationFrame (once per second under reduced motion), and recomputes the target
 * when the reset passes. Screen readers get a minute-level label instead of the ticking digits.
 */
export function TimecodeClock({
  prefix = 'TC',
  label = 'Next reel in',
  size = 'md',
  onReset,
  className,
}: TimecodeClockProps) {
  const isClient = useIsClient();
  const reduced = usePrefersReducedMotion();
  const [remaining, setRemaining] = useState<number | null>(null);
  const onResetRef = useRef(onReset);
  useEffect(() => {
    onResetRef.current = onReset;
  }, [onReset]);

  useEffect(() => {
    if (!isClient) return;
    let target = nextResetAt(new Date()).getTime();
    let raf = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastFrame = -1;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      const now = Date.now();
      let left = target - now;
      if (left <= 0) {
        target = nextResetAt(new Date(now)).getTime();
        left = target - now;
        onResetRef.current?.();
      }
      const frame = Math.floor((left * 24) / 1000);
      if (frame !== lastFrame) {
        lastFrame = frame;
        setRemaining(left);
      }
      if (reduced) timer = setTimeout(tick, 1000 - (now % 1000) + 5);
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      if (timer) clearTimeout(timer);
    };
  }, [isClient, reduced]);

  const text = remaining === null ? PLACEHOLDER : formatTimecode(remaining);
  const spoken = remaining === null ? `${label} the next reset` : `${label} ${describeRemaining(remaining)}`;

  return (
    <span role="timer" aria-label={spoken} className={cx('gl-tc', size === 'lg' && 'gl-tc--lg', className)}>
      <span className="gl-tc__k" aria-hidden="true">
        {prefix}
      </span>
      <span className="gl-tc__v" aria-hidden="true">
        {text}
      </span>
    </span>
  );
}
