// GET /api/share/card (design brief v2, principle 8): the share card PNG for any mode.
//   f=portrait 1080x1350 (feeds, stories)   f=wide 1200x630 (link previews, X)
// The query is a strictly validated ArtifactCard (see decodeArtifactQuery): mode, reel, date,
// outcome, stat, caption, verdict grid, hinted. No titles or other free text can pass, and the
// share url/text are never part of it. The image is a pure function of its params, so it is
// cached for a year. Anything malformed is a 400.
import { ImageResponse } from 'next/og';
import { ARTIFACT_FORMATS, ARTIFACT_LIMITS, decodeArtifactQuery } from '@/components/share/artifactCodec';
import { ArtifactImage } from '@/components/share/og/ArtifactImage';
import { loadGrain } from '@/components/share/og/grain';

const IMAGE_CACHE_CONTROL = 'public, max-age=31536000, s-maxage=31536000, immutable';

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (url.search.length > ARTIFACT_LIMITS.queryMax) return badRequest('query too long');
  const decoded = decodeArtifactQuery(url.searchParams);
  if (!decoded.ok) return badRequest(decoded.error);

  const grainSrc = await loadGrain();
  return new ImageResponse(<ArtifactImage card={decoded.card} format={decoded.format} grainSrc={grainSrc} />, {
    ...ARTIFACT_FORMATS[decoded.format],
    headers: { 'Cache-Control': IMAGE_CACHE_CONTROL },
  });
}

function badRequest(message: string): Response {
  return Response.json(
    { error: { code: 'bad_request', message } },
    { status: 400, headers: { 'Cache-Control': 'public, max-age=300, s-maxage=3600' } },
  );
}
