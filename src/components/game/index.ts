// Game UI components (WS5): Slate, GuessRow, PersonCell, NumberCell, LabelCell, GenreChips, SearchBox,
// ScriptNotes, GiveUp, ResultCard, GameBoard. None of these ever receive the answer before the
// round ends; ResultCard renders the server's reveal.
export { GameBoard } from './GameBoard';
export type { GameBoardProps } from './GameBoard';
export { Slate } from './Slate';
export type { SlateProps } from './Slate';
export { GuessRow, PendingRow, CLAP_LEAD_IN } from './GuessRow';
export type { GuessRowProps } from './GuessRow';
export { PersonCell } from './PersonCell';
export { NumberCell } from './NumberCell';
export { LabelCell, RatingCell, StudioCell } from './LabelCell';
export { GenreChips, GenreCountCell } from './GenreChips';
export { SearchBox, defaultSearch } from './SearchBox';
export type { SearchBoxProps, SearchFn } from './SearchBox';
export { ScriptNotes } from './ScriptNotes';
export { HintContent, hintText } from './HintContent';
export { GiveUp } from './GiveUp';
export { ResultCard, resultHeadline } from './ResultCard';
export { DistributionChart } from './DistributionChart';
export { TrailerEmbed } from './TrailerEmbed';
export { Poster } from './Poster';
export { VaultResultBadge } from './VaultResultBadge';
