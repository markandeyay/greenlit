// Call Sheet components (WS3).
//
// Usage for WS5 (Section 6.5 layout):
//   - Desktop (>= 1024px): render <CallSheet variant="panel" .../> in the right column, wrapped in
//     a sticky container, e.g. <aside className="hidden lg:block sticky top-4">.
//   - Mobile: render <CallSheetStrip .../> directly under the search box. It is sticky and
//     `lg:hidden` by default (pass className to override).
// Both take the same props: feedback (oldest first), reelNumber, take, maxGuesses, plus optional
// highlighted / onRowSelect (row toggles report 0-based guess indices into `feedback`) and
// playerRegion (shows a region tag when the rating was compared under a fallback region).
export { CallSheet, CallSheetHeader, ConfirmedTag, CutTag } from './CallSheet';
export type { CallSheetProps, CallSheetRowId } from './CallSheet';
export { CallSheetStrip } from './CallSheetStrip';
export type { CallSheetStripProps } from './CallSheetStrip';
export { RangeBar } from './RangeBar';
export type { RangeBarProps, RangeBarTick } from './RangeBar';
