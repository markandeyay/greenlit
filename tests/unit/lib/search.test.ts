import { describe, expect, it } from 'vitest';
import { normalizeForSearch, scoreTitleMatch } from '@/lib/search';

describe('search matching', () => {
  const s = (q: string, t: string) => scoreTitleMatch(normalizeForSearch(q), t);
  it('normalizes', () => {
    expect(normalizeForSearch('  Amélie & Co.! ')).toBe('amelie and co');
  });
  it('ranks exact > prefix > word > fuzzy', () => {
    expect(s('inception', 'Inception')).toBe(100);
    expect(s('dark kn', 'The Dark Knight')).toBeGreaterThan(s('knight', 'The Dark Knight') - 1);
    expect(s('knight dark', 'The Dark Knight')).toBe(45);
    expect(s('interstelar', 'Interstellar')).toBe(30);
    expect(s('zzz', 'Inception')).toBe(0);
  });
});
