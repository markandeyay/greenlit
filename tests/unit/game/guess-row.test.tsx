// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { GuessRow } from '@/components/game/GuessRow';
import { RULES } from '@/config/rules';
import { fb } from './fixtures';

afterEach(cleanup);

const byLabel = (re: RegExp) => screen.getByRole('img', { name: re });

describe('GuessRow', () => {
  it('renders the title, take number and grouped cells', () => {
    render(<GuessRow feedback={fb()} take={3} playerRegion="US" />);
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Heat');
    expect(screen.getByRole('group', { name: 'People' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Numbers' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Labels' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Genres' })).toBeInTheDocument();
  });

  it('labels numeric cells with verdict and direction words, none on match', () => {
    render(<GuessRow feedback={fb()} take={1} playerRegion="US" />);
    const year = byLabel(/^Year 1995/);
    expect(year).toHaveAttribute('aria-label', 'Year 1995, close, answer is later.');
    expect(year).toHaveTextContent('LATER');
    expect(year).toHaveTextContent('≈');
    const box = byLabel(/^Box office/);
    expect(box).toHaveTextContent('$187M');
    expect(box).toHaveTextContent('SMALLER');
    expect(box.getAttribute('aria-label')).toContain('answer is smaller');
    const score = byLabel(/^Score 79/);
    expect(score).toHaveAttribute('aria-label', 'Score 79, match.');
    expect(score).toHaveTextContent('✓');
    expect(score).not.toHaveTextContent(/HIGHER|LOWER/);
  });

  it('shows N/A box office in the neutral style with no word', () => {
    render(
      <GuessRow feedback={fb({ boxOffice: { value: null, verdict: 'na', direction: null } })} take={1} playerRegion="US" />,
    );
    const box = byLabel(/^Box office/);
    expect(box).toHaveAttribute('data-verdict', 'na');
    expect(box).toHaveTextContent('N/A');
    expect(box).not.toHaveTextContent(/BIGGER|SMALLER/);
    expect(box).toHaveAttribute('aria-label', 'Box office, not available.');
  });

  it('shows a region tag only when the rating region differs from the player region', () => {
    const { rerender } = render(<GuessRow feedback={fb()} take={1} playerRegion="US" />);
    expect(byLabel(/^Rating/)).not.toHaveTextContent('US');
    rerender(<GuessRow feedback={fb()} take={1} playerRegion="GB" />);
    const rating = byLabel(/^Rating/);
    expect(rating).toHaveTextContent('US');
    expect(rating.getAttribute('aria-label')).toContain('compared using US ratings');
  });

  it('draws dashed empty supporting slots up to the cap', () => {
    render(<GuessRow feedback={fb()} take={1} />);
    const people = screen.getByRole('group', { name: 'People' });
    const empties = within(people).getAllByRole('img', { name: /empty slot/ });
    expect(empties).toHaveLength(RULES.maxSupportingCast - 2);
    expect(empties[0]).toHaveAttribute('data-verdict', 'empty');
  });

  it('shows role tags only on matched people', () => {
    render(<GuessRow feedback={fb()} take={1} />);
    const deNiro = byLabel(/Robert De Niro/);
    expect(deNiro).toHaveTextContent('LEAD');
    expect(deNiro.getAttribute('aria-label')).toBe('Supporting 1 Robert De Niro, match, in the answer as lead.');
    const pacino = byLabel(/Al Pacino/);
    expect(pacino).not.toHaveTextContent(/LEAD|SUPP/);
    expect(pacino.getAttribute('aria-label')).toBe('Lead Al Pacino, no match.');
  });

  it('labels genre chips with words and a matched count', () => {
    render(<GuessRow feedback={fb()} take={1} />);
    const genres = screen.getByRole('list', { name: 'Genres' });
    expect(within(genres).getByText('Crime').parentElement).toHaveTextContent('✓');
    expect(genres).toHaveTextContent(', match');
    expect(genres).toHaveTextContent(', no match');
    expect(byLabel(/^Genres: 1 of the answer's 3 genres/)).toBeInTheDocument();
  });

  it('draws a split portrait for co-directing units', () => {
    render(
      <GuessRow feedback={fb({ director: { display: 'Joel Coen', verdict: 'match', personIds: [1, 2] } })} take={1} />,
    );
    const dir = byLabel(/^Director/);
    expect(dir.getAttribute('aria-label')).toBe('Director Joel Coen, a 2 person directing unit, match.');
    expect(dir).toHaveTextContent('x2');
  });

  it('animates only when asked, staggering cells after the slate clap', () => {
    const { container, rerender } = render(<GuessRow feedback={fb()} take={1} />);
    expect(container.querySelectorAll('.anim-flip')).toHaveLength(0);
    rerender(<GuessRow feedback={fb()} take={1} animate />);
    const flips = [...container.querySelectorAll<HTMLElement>('.anim-flip')];
    expect(flips.length).toBeGreaterThanOrEqual(12);
    const idx = flips.map((el) => Number(el.style.getPropertyValue('--i')));
    expect(idx).toEqual([...idx].sort((a, b) => a - b));
    expect(idx[0]).toBeGreaterThan(0);
  });
});
