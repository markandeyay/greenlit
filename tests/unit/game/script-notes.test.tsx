// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScriptNotes } from '@/components/game/ScriptNotes';
import { HINT_TYPE_LABELS } from '@/config/hints';
import { RULES } from '@/config/rules';

afterEach(cleanup);

const target = { kind: 'daily' as const, ref: '4' };

describe('ScriptNotes', () => {
  it('is a quiet locked chip before the first unlock: next unlock take, nothing to expand, no fetch', () => {
    const loadOptions = vi.fn();
    render(<ScriptNotes target={target} take={1} status="in_progress" hints={[]} onReveal={vi.fn()} loadOptions={loadOptions} />);
    expect(screen.getByRole('heading', { name: /Script Notes/ })).toBeInTheDocument();
    expect(screen.getByText(`Unlocks after take ${RULES.hintUnlockAfter[0]}`)).toBeInTheDocument();
    expect(screen.queryByText(`Unlocks after take ${RULES.hintUnlockAfter[1]}`)).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('radio')).toBeNull();
    expect(loadOptions).not.toHaveBeenCalled();
  });

  it('opens by itself at the unlock, lets the player pick a note by type label, then reveal it', async () => {
    const loadOptions = vi.fn(async () => ({ slot1: ['tagline' as const, 'awards' as const], slot2: [] }));
    const onReveal = vi.fn(async () => true);
    render(
      <ScriptNotes target={target} take={RULES.hintUnlockAfter[0]} status="in_progress" hints={[]} onReveal={onReveal} loadOptions={loadOptions} />,
    );
    expect(screen.getByRole('button', { name: /Script Notes.*1 note ready/ })).toHaveAttribute('aria-expanded', 'true');
    const user = userEvent.setup();
    const reveal = await screen.findByRole('button', { name: 'Reveal note 1' });
    expect(reveal).toBeDisabled();
    await user.click(screen.getByRole('radio', { name: HINT_TYPE_LABELS.awards }));
    expect(reveal).toBeEnabled();
    await user.click(reveal);
    expect(onReveal).toHaveBeenCalledWith(1, 'awards');
    expect(screen.getByText(`Unlocks after take ${RULES.hintUnlockAfter[1]}`)).toBeInTheDocument();
  });

  it('keeps used notes behind the chip after the round, readable on expand', async () => {
    render(
      <ScriptNotes
        target={target}
        take={6}
        status="won"
        hints={[{ slot: 1, hint: { type: 'tagline', payload: { text: 'One ring' } } }]}
        onReveal={vi.fn()}
        loadOptions={vi.fn()}
      />,
    );
    const chip = screen.getByRole('button', { name: /Script Notes.*1 \/ 2 used/ });
    expect(chip).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText(/One ring/)).not.toBeVisible();
    await userEvent.setup().click(chip);
    expect(chip).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/One ring/)).toBeVisible();
    expect(screen.getByText('Not used')).toBeVisible();
  });
});
