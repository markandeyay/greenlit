import { describe, expect, it } from 'vitest';
import { GET } from '@/app/api/share/card/route';
import { artifactImageUrl, buildArtifact } from '@/components/share/artifactCodec';
import { classicArtifact } from '@/components/share/classicArtifact';
import { SECRET_TITLE, specExample } from './fixtures';

const req = (path: string) => new Request(`http://localhost${path}`);
const PNG = [0x89, 0x50, 0x4e, 0x47];

async function expectPng(res: Response, width: number, height: number) {
  expect(res.status).toBe(200);
  expect(res.headers.get('content-type')).toBe('image/png');
  const cc = res.headers.get('cache-control') ?? '';
  expect(cc).toContain('public');
  expect(cc).toContain('immutable');
  const bytes = new Uint8Array(await res.arrayBuffer());
  expect([...bytes.slice(0, 4)]).toEqual(PNG);
  // IHDR width and height (big endian at bytes 16..23).
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  expect(view.getUint32(16)).toBe(width);
  expect(view.getUint32(20)).toBe(height);
}

describe('GET /api/share/card', () => {
  it('renders a classic win as a portrait and a wide PNG', async () => {
    const a = classicArtifact(specExample({ hintsUsed: 1 }));
    await expectPng(await GET(req(artifactImageUrl(a, 'portrait'))), 1080, 1350);
    await expectPng(await GET(req(artifactImageUrl(a, 'wide'))), 1200, 630);
  }, 60_000);

  it('renders a loss, a gridless score card and a ragged grid', async () => {
    const artifacts = [
      classicArtifact(specExample({ status: 'lost' })),
      buildArtifact({ mode: 'opening_weekend', date: '2026-10-04', outcome: 'score', stat: '12', statCaption: 'in a row', url: 'https://x.test/', text: 'x' }),
      buildArtifact({ mode: 'casting_call', outcome: 'won', stat: '3 links', statCaption: 'optimal 2', grid: [['match', 'match', 'match'], ['empty']], url: 'https://x.test/', text: 'x' }),
    ];
    for (const a of artifacts) {
      for (const f of ['portrait', 'wide'] as const) {
        const res = await GET(req(artifactImageUrl(a, f)));
        expect(res.status, `${a.mode} ${f}`).toBe(200);
        await res.arrayBuffer();
      }
    }
  }, 60_000);

  it.each([
    ['a title in the stat', '/api/share/card?m=d&n=1&o=w&s=Jaws'],
    ['a smuggled title param', `/api/share/card?m=d&n=1&o=w&s=1&t=${encodeURIComponent(SECRET_TITLE)}`],
    ['a bad enum', '/api/share/card?m=d&n=1&o=maybe&s=1'],
    ['an overlong query', `/api/share/card?m=d&o=w&s=1&g=${'g'.repeat(800)}`],
    ['no params', '/api/share/card'],
  ])('rejects %s with 400', async (_l, path) => {
    const res = await GET(req(path));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('bad_request');
  });
});
