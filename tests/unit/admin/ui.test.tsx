// @vitest-environment jsdom
// Admin UI pieces.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { DAILY_HINT_TYPES, HintEditor, HintPreview, emptyHint, parseFilmLines } from '@/components/admin/HintEditor';
import type { Hint } from '@/lib/types';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('HintEditor helpers', () => {
  it('never offers creator_note for dailies', () => {
    expect(DAILY_HINT_TYPES).not.toContain('creator_note');
    expect(DAILY_HINT_TYPES).toContain('first_letter');
  });

  it('builds empty payloads and parses filmography lines', () => {
    expect(emptyHint('plot_keywords')).toEqual({ type: 'plot_keywords', payload: { keywords: [] } });
    expect(emptyHint('awards')).toEqual({ type: 'awards', payload: { text: '' } });
    expect(parseFilmLines('Heat (1995)\n\n  Collateral (2004) \nNo year')).toEqual([
      { title: 'Heat', year: 1995 },
      { title: 'Collateral', year: 2004 },
      { title: 'No year', year: 0 },
    ]);
  });

  it('edits a hint through the typed form and switches types', async () => {
    const user = userEvent.setup();
    let latest: Hint[] = [];
    function Harness() {
      const [hints, setHints] = useState<Hint[]>([
        { type: 'tagline', payload: { text: 'Old' } },
        { type: 'awards', payload: { text: 'Won' } },
        { type: 'decade_vibe', payload: { text: '1990s' } },
      ]);
      latest = hints;
      return <HintEditor hints={hints} onChange={setHints} />;
    }
    render(<Harness />);
    const first = screen.getAllByLabelText('Text')[0]!;
    await user.clear(first);
    await user.type(first, 'New tagline');
    expect(latest[0]).toEqual({ type: 'tagline', payload: { text: 'New tagline' } });
    await user.selectOptions(screen.getAllByLabelText('Type')[2]!, 'first_letter');
    expect(latest[2]).toEqual({ type: 'first_letter', payload: { letter: '' } });
  });

  it('previews every hint as text', () => {
    render(<HintPreview hint={{ type: 'cast_connection', payload: { personName: 'A', filmTitle: 'B', filmYear: 2000 } }} />);
    expect(screen.getByText(/A was in B \(2000\)/)).toBeInTheDocument();
  });
});

