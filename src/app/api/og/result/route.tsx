// GET /api/og/result (Sections 7.2, 9): 1200x630 PNG of a finished classic play, kept for
// existing links. The query holds ONLY verdicts (see encodeShareGrid); it is decoded strictly and
// drawn with the same wide share card as /api/share/card, so every shared image looks the same.
// The image is a pure function of its params and is cached for a year. Anything malformed is a
// 400.
import { ImageResponse } from 'next/og';
import { ARTIFACT_FORMATS } from '@/components/share/artifactCodec';
import { classicCard } from '@/components/share/classicArtifact';
import { ArtifactImage } from '@/components/share/og/ArtifactImage';
import { loadGrain } from '@/components/share/og/grain';
import { decodeShareGrid } from '@/components/share/shareGrid';

const IMAGE_CACHE_CONTROL = 'public, max-age=31536000, s-maxage=31536000, immutable';

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (url.search.length > 200) return badRequest('query too long');
  const decoded = decodeShareGrid(url.searchParams);
  if (!decoded.ok) return badRequest(decoded.error);

  const grainSrc = await loadGrain();
  return new ImageResponse(<ArtifactImage card={classicCard(decoded.grid)} format="wide" grainSrc={grainSrc} />, {
    ...ARTIFACT_FORMATS.wide,
    headers: { 'Cache-Control': IMAGE_CACHE_CONTROL },
  });
}

function badRequest(message: string): Response {
  return Response.json(
    { error: { code: 'bad_request', message } },
    { status: 400, headers: { 'Cache-Control': 'public, max-age=300, s-maxage=3600' } },
  );
}
