import { StatusCell } from '@/components/ui/StatusCell';
import { cellAriaLabel, directionWord } from '@/components/ui/status';
import { formatBoxOffice, formatPlain, speakBoxOffice } from '@/lib/format';
import type { NumberFeedback } from '@/lib/types';

export type NumberAttribute = 'year' | 'boxOffice' | 'score';

const LABEL: Record<NumberAttribute, string> = {
  year: 'Year',
  boxOffice: 'Box office',
  score: 'Score',
};

/**
 * Numeric cell (Section 6.4): big tabular number, label, and a direction WORD (LATER / EARLIER,
 * BIGGER / SMALLER, HIGHER / LOWER) on close and miss cells. Matches show no word; unknown box
 * office shows N/A in the neutral style.
 */
export function NumberCell({
  attribute,
  feedback,
  index,
  animate = false,
}: {
  attribute: NumberAttribute;
  feedback: NumberFeedback;
  index?: number;
  animate?: boolean;
}) {
  const label = LABEL[attribute];
  const verdict = feedback.value === null && attribute === 'boxOffice' ? 'na' : feedback.verdict;
  const word = directionWord(attribute, feedback.direction, verdict);
  const value = attribute === 'boxOffice' ? formatBoxOffice(feedback.value) : formatPlain(feedback.value);
  const spokenValue = attribute === 'boxOffice' ? speakBoxOffice(feedback.value) : value;
  return (
    <StatusCell
      verdict={verdict}
      label={label}
      value={value}
      direction={word}
      index={index}
      animate={animate}
      ariaLabel={cellAriaLabel({ label, value: verdict === 'na' ? null : spokenValue, verdict, direction: word })}
    />
  );
}
