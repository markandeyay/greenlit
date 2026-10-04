import { Fragment } from 'react';
import { cx } from '@/components/ui/cx';

export interface SlateMetaProps {
  roll?: string | number;
  reel?: number;
  scene?: number;
  take?: number;
  /** Extra trailing fields, e.g. "24 fps". */
  extra?: readonly string[];
  /** Hide from assistive tech when it repeats information shown elsewhere. */
  decorative?: boolean;
  className?: string;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Slate metadata line above major sections: Roll 2026 · Reel 212 · Sc 01 · Tk 04. */
export function SlateMeta({ roll, reel, scene, take, extra = [], decorative = false, className }: SlateMetaProps) {
  const fields: Array<[string, string]> = [];
  if (roll !== undefined) fields.push(['Roll', String(roll)]);
  if (reel !== undefined) fields.push(['Reel', String(reel).padStart(3, '0')]);
  if (scene !== undefined) fields.push(['Sc', pad2(scene)]);
  if (take !== undefined) fields.push(['Tk', pad2(take)]);
  return (
    <p className={cx('gl-slate-meta', className)} aria-hidden={decorative || undefined}>
      {fields.map(([k, v], i) => (
        <Fragment key={k}>
          {i > 0 ? ' · ' : null}
          {k} <b>{v}</b>
        </Fragment>
      ))}
      {extra.map((e) => (
        <Fragment key={e}>
          {fields.length > 0 ? ' · ' : null}
          {e}
        </Fragment>
      ))}
    </p>
  );
}
