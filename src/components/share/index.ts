// Sharing (WS6): ShareSheet, share text, verdict-only grid encoding for /api/og/result.
export { ShareSheet } from './ShareSheet';
export type { ShareSheetExtraProps } from './ShareSheet';
export type { ShareInput, ShareSheetProps } from './types';
export {
  buildShareText,
  buildShareBody,
  describeShare,
  shareHeader,
  sharePath,
  shareUrl,
  takeLabel,
  reelLabel,
  SQUARE,
  ROW_MARK,
} from './shareText';
export {
  encodeShareGrid,
  encodeGrid,
  decodeShareGrid,
  feedbackToCells,
  gridFromInput,
  shareImagePath,
  SHARE_COLUMNS,
  CELLS_PER_ROW,
} from './shareGrid';
export type { ShareCell, ShareGrid, DecodeResult } from './shareGrid';
export { copyText, canUseNativeShare, xIntentUrl } from './shareActions';
