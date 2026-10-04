import Image from 'next/image';
import { tmdbImage } from '@/config/brand';
import { REGIONS } from '@/config/regions';
import { StatusCell } from '@/components/ui/StatusCell';
import { Tag } from '@/components/ui/Tag';
import { cellAriaLabel } from '@/components/ui/status';
import type { GuessFeedback, RegionCode } from '@/lib/types';

/**
 * Rating cell. Binary match / no match (N/A when the guessed film has no certification). When the
 * comparison used a different region than the player's (the answer has no rating there), a tiny
 * region tag says which board was used.
 */
export function RatingCell({
  rating,
  playerRegion,
  index,
  animate = false,
}: {
  rating: GuessFeedback['rating'];
  playerRegion?: RegionCode;
  index?: number;
  animate?: boolean;
}) {
  const showRegion = !!playerRegion && rating.region !== playerRegion;
  const regionLabel = REGIONS[rating.region]?.label ?? rating.region;
  const value = rating.value ?? 'N/A';
  return (
    <StatusCell
      verdict={rating.verdict}
      label="Rating"
      value={value}
      index={index}
      animate={animate}
      tag={showRegion ? <Tag title={`Compared using ${regionLabel} ratings`}>{regionLabel}</Tag> : undefined}
      ariaLabel={cellAriaLabel({
        label: 'Rating',
        value: rating.value,
        verdict: rating.verdict,
        extra: showRegion ? `compared using ${regionLabel} ratings` : null,
      })}
    />
  );
}

/** Studio cell: headline studio, binary match. Logo from TMDB when available, text otherwise. */
export function StudioCell({
  studio,
  index,
  animate = false,
}: {
  studio: GuessFeedback['studio'];
  index?: number;
  animate?: boolean;
}) {
  const logo = tmdbImage(studio.logoPath, 'w92');
  return (
    <StatusCell
      verdict={studio.verdict}
      label="Studio"
      value={studio.name}
      index={index}
      animate={animate}
      ariaLabel={cellAriaLabel({ label: 'Studio', value: studio.name, verdict: studio.verdict })}
    >
      <span className="gl-cell__value flex min-w-0 items-end gap-2 text-[15px]! leading-tight!">
        {logo ? (
          <span className="relative block h-5 w-10 flex-none">
            <Image src={logo} alt="" fill sizes="40px" unoptimized className="object-contain object-left" />
          </span>
        ) : null}
        <span className="line-clamp-2 min-w-0">{studio.name}</span>
      </span>
    </StatusCell>
  );
}

/** Rating and studio, together (Section 6.4 LabelCell). */
export function LabelCell(
  props:
    | { kind: 'rating'; rating: GuessFeedback['rating']; playerRegion?: RegionCode; index?: number; animate?: boolean }
    | { kind: 'studio'; studio: GuessFeedback['studio']; index?: number; animate?: boolean },
) {
  if (props.kind === 'rating') {
    return <RatingCell rating={props.rating} playerRegion={props.playerRegion} index={props.index} animate={props.animate} />;
  }
  return <StudioCell studio={props.studio} index={props.index} animate={props.animate} />;
}
