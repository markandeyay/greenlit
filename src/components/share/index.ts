// Sharing (WS6 + brief v2 principle 8): ShareSheet, ShareArtifactPanel and the artifact builders
// (buildArtifact, artifactImageUrl) for every mode, share text, verdict-only grid encoding.
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
export { ShareArtifactPanel } from './ShareArtifactPanel';
export type { ShareArtifact, ShareArtifactPanelProps, ArtifactMode, ArtifactCell } from './artifact';
export { shareBodyFromText, artifactFileName } from './ShareArtifactPanel';
export { classicArtifact } from './classicArtifact';
export {
  buildArtifact,
  artifactImageUrl,
  encodeArtifactQuery,
  decodeArtifactQuery,
  checkArtifactCard,
  isSafePhrase,
  toCard,
  ArtifactError,
  ARTIFACT_FORMATS,
  ARTIFACT_LIMITS,
  ARTIFACT_MODES,
  ARTIFACT_WORDS,
  ARTIFACT_IMAGE_PATH,
  REEL_MODES,
} from './artifactCodec';
export type { ArtifactCard, ArtifactFormat, BuildArtifactInput, DecodedArtifact, ArtifactCheck } from './artifactCodec';
export { ARTIFACT_MODE_STYLE, describeArtifact, formatArtifactDate } from './artifactModes';
