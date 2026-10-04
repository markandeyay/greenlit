// @vitest-environment jsdom
import { act, fireEvent, render, screen, cleanup } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import { AccentText, parseAccent } from '@/components/ui/Heading';
import { StatusCell } from '@/components/ui/StatusCell';
import { StatusGlyph } from '@/components/ui/StatusGlyph';
import { Switch } from '@/components/ui/Switch';
import { Tabs } from '@/components/ui/Tabs';
import { ToastProvider, useToast } from '@/components/ui/Toast';
import { cellAriaLabel, directionWord, statusGlyph, verdictWords } from '@/components/ui/status';
import { Breadcrumb } from '@/components/chrome/Breadcrumb';
import { SceneHeading } from '@/components/chrome/SceneHeading';
import { SlateMeta } from '@/components/chrome/SlateMeta';

afterEach(cleanup);

describe('status vocabulary', () => {
  it('glyphs: check for match, approx for close, none otherwise', () => {
    expect(statusGlyph('match')).toBe('✓');
    expect(statusGlyph('close')).toBe('≈');
    expect(statusGlyph('miss')).toBeNull();
    expect(statusGlyph('na')).toBeNull();
  });
  it('direction words, hidden on match and n/a', () => {
    expect(directionWord('year', 'up', 'close')).toBe('LATER');
    expect(directionWord('year', 'down', 'miss')).toBe('EARLIER');
    expect(directionWord('boxOffice', 'up', 'miss')).toBe('BIGGER');
    expect(directionWord('score', 'down', 'close')).toBe('LOWER');
    expect(directionWord('score', 'up', 'match')).toBeNull();
    expect(directionWord('boxOffice', null, 'na')).toBeNull();
  });
  it('aria labels read like the spec', () => {
    expect(cellAriaLabel({ label: 'Year', value: 2006, verdict: 'close', direction: 'LATER' })).toBe(
      'Year 2006, close, answer is later.',
    );
    expect(verdictWords('miss')).toBe('no match');
  });
});

describe('<StatusCell>', () => {
  it('fills by verdict, shows the glyph and a full label', () => {
    render(<StatusCell verdict="close" label="Year" value="2008" direction="LATER" />);
    const cell = screen.getByRole('img', { name: 'Year 2008, close, answer is later.' });
    expect(cell).toHaveAttribute('data-verdict', 'close');
    expect(cell).toHaveClass('gl-cell');
    expect(cell.textContent).toContain('≈');
    expect(cell.textContent).toContain('LATER');
  });
  it('match shows a check and no direction word', () => {
    render(<StatusCell verdict="match" label="Year" value="2010" direction="LATER" />);
    const cell = screen.getByRole('img', { name: 'Year 2010, match.' });
    expect(cell.textContent).toContain('✓');
    expect(cell.textContent).not.toContain('LATER');
  });
  it('miss has no glyph', () => {
    const { container } = render(<StatusGlyph verdict="miss" />);
    expect(container.textContent).toBe('');
  });
});

describe('<Dialog>', () => {
  function Harness() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open</Button>
        <Dialog
          open={open}
          onClose={() => setOpen(false)}
          title="Share your take"
          description="Squares only."
          actions={
            <>
              <Button>First</Button>
              <Button>Last</Button>
            </>
          }
        />
      </>
    );
  }

  it('is a labelled modal, traps focus, closes on Escape and restores focus', () => {
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Open' });
    opener.focus();
    fireEvent.click(opener);
    const dlg = screen.getByRole('dialog', { name: 'Share your take' });
    expect(dlg).toHaveAttribute('aria-modal', 'true');
    expect(dlg).toHaveAccessibleDescription('Squares only.');
    // First focusable is the corner Close button.
    const close = screen.getByRole('button', { name: 'Close' });
    expect(document.activeElement).toBe(close);
    const last = screen.getByRole('button', { name: 'Last' });
    last.focus();
    fireEvent.keyDown(dlg, { key: 'Tab' });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(dlg, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(dlg, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('ConfirmDialog is an alertdialog that starts on Cancel', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog open title="Walk away?" confirmLabel="Walk away" onConfirm={onConfirm} onCancel={onCancel} tone="danger" />,
    );
    expect(screen.getByRole('alertdialog', { name: 'Walk away?' })).toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Walk away' }));
    expect(onConfirm).toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' });
    expect(onCancel).toHaveBeenCalled();
  });
});

describe('<Tabs>', () => {
  it('roving tabindex with arrows, Home and End', () => {
    render(
      <Tabs
        label="Period"
        tabs={[
          { id: 'a', label: 'Weekly', content: 'A panel' },
          { id: 'b', label: 'All time', content: 'B panel' },
          { id: 'c', label: 'Streaks', content: 'C panel' },
        ]}
      />,
    );
    const [a, b, c] = screen.getAllByRole('tab');
    expect(a).toHaveAttribute('aria-selected', 'true');
    expect(b).toHaveAttribute('tabindex', '-1');
    fireEvent.keyDown(a!, { key: 'ArrowRight' });
    expect(b).toHaveAttribute('aria-selected', 'true');
    expect(document.activeElement).toBe(b);
    expect(screen.getByRole('tabpanel')).toHaveTextContent('B panel');
    fireEvent.keyDown(b!, { key: 'End' });
    expect(c).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(c!, { key: 'ArrowRight' });
    expect(a).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(a!, { key: 'ArrowLeft' });
    expect(c).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(c!, { key: 'Home' });
    expect(a).toHaveAttribute('aria-selected', 'true');
  });
});

describe('<Switch>', () => {
  it('is a switch with a visible state word', () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} label="Colorblind mode" />);
    const sw = screen.getByRole('switch', { name: 'Colorblind mode' });
    expect(sw).toHaveAttribute('aria-checked', 'false');
    expect(sw.textContent).toContain('Off');
    fireEvent.click(sw);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe('<Toast>', () => {
  function Fire() {
    const { toast } = useToast();
    return <button onClick={() => toast('Copied', { duration: 0 })}>fire</button>;
  }
  it('announces through a polite live region and dismisses', () => {
    render(
      <ToastProvider>
        <Fire />
      </ToastProvider>,
    );
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    act(() => screen.getByText('fire').click());
    expect(region).toHaveTextContent('Copied');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(region).not.toHaveTextContent('Copied');
  });
});

describe('motifs', () => {
  it('accent parsing', () => {
    expect(parseAccent('The *Vault*')).toEqual([
      { text: 'The ', accent: false },
      { text: 'Vault', accent: true },
    ]);
    const { container } = render(<AccentText text="Awards *Night*" />);
    expect(container.querySelector('em.ty-accent')?.textContent).toBe('Night');
  });
  it('scene heading: numbered slugline and a real heading', () => {
    render(<SceneHeading n={1} slug="INT. THE CALL SHEET - NIGHT" title="The *Call Sheet*" meta="Everything so far" />);
    expect(screen.getByRole('heading', { level: 2, name: 'The Call Sheet' })).toBeInTheDocument();
    expect(screen.getAllByText('01')).toHaveLength(2);
    expect(screen.getByText('INT.')).toBeInTheDocument();
  });
  it('slate meta line', () => {
    const { container } = render(<SlateMeta roll={2026} reel={212} scene={1} take={4} />);
    expect(container.textContent).toBe('Roll 2026 · Reel 212 · Sc 01 · Tk 04');
  });
  it('breadcrumb with chevrons and current page', () => {
    render(<Breadcrumb items={[{ label: 'APP', href: '/' }, { label: '2026', href: '/vault' }, { label: '212A' }]} />);
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(nav.textContent).toBe('APP▸2026▸212A');
    expect(screen.getByText('212A')).toHaveAttribute('aria-current', 'page');
  });
});
