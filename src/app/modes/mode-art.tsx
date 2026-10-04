// Small line illustrations for each mode card on the hub. Decorative only (aria-hidden).
import type { ReactNode } from 'react';
import type { ModeId } from '@/config/modes';

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

const ART: Record<ModeId, ReactNode> = {
  // A clapperboard: the daily reel.
  classic: (
    <Svg>
      <rect x="7" y="19" width="34" height="21" rx="2" />
      <path d="M7 19l2.5-8.5 32 3.5L41 19" />
      <path d="M15 11.5l-2 7M23 12.5l-2 6.5M31 13.5l-2 5.5" />
      <path d="M14 27h20M14 33h12" />
    </Svg>
  ),
  // A reel: endless practice.
  unlimited: (
    <Svg>
      <circle cx="24" cy="24" r="16" />
      <circle cx="24" cy="24" r="2.5" />
      <circle cx="24" cy="14.5" r="3.5" />
      <circle cx="24" cy="33.5" r="3.5" />
      <circle cx="14.5" cy="24" r="3.5" />
      <circle cx="33.5" cy="24" r="3.5" />
    </Svg>
  ),
  // Two posters, one higher.
  opening_weekend: (
    <Svg>
      <rect x="6" y="14" width="15" height="22" rx="1.5" />
      <rect x="27" y="10" width="15" height="22" rx="1.5" />
      <path d="M34.5 41v-5M31.5 38.5l3-3 3 3" />
      <path d="M13.5 39v2" />
    </Svg>
  ),
  // Cards in a sorted row.
  release_order: (
    <Svg>
      <path d="M8 38h32" />
      <rect x="9" y="26" width="6" height="12" rx="1" />
      <rect x="17.5" y="20" width="6" height="18" rx="1" />
      <rect x="26" y="14" width="6" height="24" rx="1" />
      <rect x="34.5" y="8" width="5.5" height="30" rx="1" />
    </Svg>
  ),
  // Two people joined by a link.
  casting_call: (
    <Svg>
      <circle cx="12" cy="17" r="5" />
      <path d="M4 34c1.5-5.5 4.5-8 8-8s6.5 2.5 8 8" />
      <circle cx="36" cy="17" r="5" />
      <path d="M28 34c1.5-5.5 4.5-8 8-8s6.5 2.5 8 8" />
      <path d="M19 20h10" strokeDasharray="2 3" />
    </Svg>
  ),
  // A quoted line of script.
  logline: (
    <Svg>
      <path d="M8 12h32M8 20h32M8 28h22" />
      <path d="M33 33c0 3 2 5 5 5M40 31v-3" />
      <path d="M8 36h14" />
    </Svg>
  ),
};

export function ModeArt({ mode }: { mode: ModeId }) {
  return <>{ART[mode]}</>;
}
