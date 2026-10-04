// @vitest-environment jsdom
// Logline client boundaries: the content module is reachable only from the server engine, client
// files never import server code, and the script page renders no text for locked drafts.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScriptPage } from '@/components/modes/logline/ScriptPage';

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(name) ? [p] : [];
  });
}

const SRC = join(process.cwd(), 'src');

describe('logline boundaries', () => {
  it('logline-data is imported only by the server engine, which is server only', () => {
    const importers = walk(SRC)
      .filter((f) => /logline-data/.test(readFileSync(f, 'utf8')) && !f.endsWith('logline-data.ts'))
      .map((f) => f.slice(SRC.length + 1).replace(/\\/g, '/'));
    expect(importers).toEqual(['server/modes/logline.ts']);
    expect(readFileSync(join(SRC, 'server/modes/logline-data.ts'), 'utf8')).toMatch(/^import 'server-only';/m);
    expect(readFileSync(join(SRC, 'server/modes/logline.ts'), 'utf8')).toMatch(/^import 'server-only';/m);
  });

  it('logline client components never import server modules', () => {
    for (const f of walk(join(SRC, 'components/modes/logline'))) {
      expect(readFileSync(f, 'utf8'), f).not.toMatch(/from '@\/server\//);
    }
  });

  it('locked drafts render as bars with no text', () => {
    render(<ScriptPage tiers={['First cryptic draft text here.']} totalTiers={4} />);
    expect(screen.getAllByTestId('logline-tier')).toHaveLength(1);
    expect(screen.getAllByText(/locked until a missed take/)).toHaveLength(3);
  });
});
