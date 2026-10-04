import { describe, expect, it } from 'vitest';
import { compareBoxOffice, compareScore, compareYear } from '@/lib/verdicts';

describe('numeric verdicts', () => {
  it('year', () => {
    expect(compareYear(2006, 2010)).toEqual({ value: 2006, verdict: 'miss', direction: 'up' });
    expect(compareYear(2008, 2010)).toEqual({ value: 2008, verdict: 'close', direction: 'up' });
    expect(compareYear(2013, 2010)).toEqual({ value: 2013, verdict: 'close', direction: 'down' });
    expect(compareYear(2010, 2010)).toEqual({ value: 2010, verdict: 'match', direction: null });
  });
  it('score', () => {
    expect(compareScore(80, 85).verdict).toBe('close');
    expect(compareScore(79, 85).verdict).toBe('miss');
    expect(compareScore(null, 85).verdict).toBe('na');
  });
  it('box office is ratio based', () => {
    expect(compareBoxOffice(105, 100).verdict).toBe('match');
    expect(compareBoxOffice(110, 100).verdict).toBe('match');
    expect(compareBoxOffice(111, 100)).toEqual({ value: 111, verdict: 'close', direction: 'down' });
    expect(compareBoxOffice(50, 100)).toEqual({ value: 50, verdict: 'close', direction: 'up' });
    expect(compareBoxOffice(49, 100).verdict).toBe('miss');
    expect(compareBoxOffice(null, 100)).toEqual({ value: null, verdict: 'na', direction: null });
    expect(compareBoxOffice(100, null).verdict).toBe('na');
  });
});
