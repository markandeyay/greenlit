import { describe, expect, it } from 'vitest';
import { GameApiError } from '@/lib/game/api';
import { dealReel, readStoredReel, REEL_STORAGE_KEY, resumeReel, writeStoredReel } from '@/components/modes/unlimited/reel-client';

function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    m,
  };
}

const jsonRes = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('stored reel', () => {
  it('round trips and clears', () => {
    const s = memoryStorage();
    writeStoredReel({ ref: 'abc_-123', band: 'cinephile' }, s);
    expect(readStoredReel(s)).toEqual({ ref: 'abc_-123', band: 'cinephile' });
    writeStoredReel(null, s);
    expect(readStoredReel(s)).toBeNull();
  });

  it('ignores junk', () => {
    const s = memoryStorage();
    for (const raw of ['{', '"x"', JSON.stringify({ ref: 'a b', band: 'popular' }), JSON.stringify({ ref: 'ok', band: 'hard' })]) {
      s.m.set(REEL_STORAGE_KEY, raw);
      expect(readStoredReel(s)).toBeNull();
    }
    expect(readStoredReel(undefined)).toBeNull();
  });
});

describe('reel requests', () => {
  it('deals a reel and passes the previous ref', async () => {
    let sent: unknown = null;
    const fetcher = (async (_url: string, init?: RequestInit) => {
      sent = JSON.parse(String(init?.body));
      return jsonRes(200, { ref: 'NEWREF', band: 'popular' });
    }) as typeof fetch;
    expect(await dealReel('popular', 'OLD', fetcher)).toBe('NEWREF');
    expect(sent).toEqual({ band: 'popular', after: 'OLD' });
  });

  it('surfaces API errors with their code', async () => {
    const fetcher = (async () => jsonRes(429, { error: { code: 'rate_limited', message: 'slow' } })) as typeof fetch;
    await expect(dealReel('popular', null, fetcher)).rejects.toMatchObject({ code: 'rate_limited' });
    const offline = (async () => {
      throw new TypeError('offline');
    }) as typeof fetch;
    await expect(dealReel('popular', null, offline)).rejects.toBeInstanceOf(GameApiError);
  });

  it('resume returns null for a reel that no longer resolves', async () => {
    const gone = (async () => jsonRes(404, { error: { code: 'not_found', message: 'Reel not found.' } })) as typeof fetch;
    expect(await resumeReel('X', gone)).toBeNull();
    const play = { kind: 'unlimited', ref: 'X', status: 'in_progress', take: 0, feedback: [], hints: [] };
    expect(await resumeReel('X', (async () => jsonRes(200, play)) as typeof fetch)).toEqual(play);
  });
});
