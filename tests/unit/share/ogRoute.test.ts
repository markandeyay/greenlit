import { describe, expect, it } from 'vitest';
import { GET } from '@/app/api/og/result/route';
import { encodeShareGrid } from '@/components/share/shareGrid';
import { specExample } from './fixtures';

const req = (qs: string) => new Request(`http://localhost/api/og/result?${qs}`);

describe('GET /api/og/result', () => {
  it('rejects a malformed grid with 400', async () => {
    const res = await GET(req('k=d&n=212&t=1&s=won&h=0&g=zzzz'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('bad_request');
  });

  it('rejects an overlong query with 400', async () => {
    const res = await GET(req(`k=d&n=1&t=0&s=lost&h=0&g=&x=${'a'.repeat(300)}`));
    expect(res.status).toBe(400);
  });

  it('renders a PNG with long public caching for a valid grid', async () => {
    const res = await GET(req(encodeShareGrid(specExample({ hintsUsed: 1 }))));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('cache-control')).toContain('public');
    expect(res.headers.get('cache-control')).toContain('s-maxage=31536000');
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([...bytes.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  }, 30_000);

  it('renders a loss and a pitch', async () => {
    for (const input of [
      specExample({ status: 'lost' }),
      specExample({ kind: 'pitch', ref: 'abc12345', reelNumber: null }),
    ]) {
      const res = await GET(req(encodeShareGrid(input)));
      expect(res.status).toBe(200);
      await res.arrayBuffer();
    }
  }, 30_000);
});
