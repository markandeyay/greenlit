// GET /api/og/result (Sections 7.2, 9): 1200x630 PNG of a finished play's verdict grid, styled
// as a slate. The query holds ONLY verdicts (see encodeShareGrid), so the image is a pure
// function of its params and is cached for a year. Anything malformed is a 400.
import { ImageResponse } from 'next/og';
import { decodeShareGrid } from '@/components/share/shareGrid';
import { ResultImage } from '@/components/share/og/ResultImage';
import { OG_SIZE } from '@/components/share/og/ogTheme';

const IMAGE_CACHE_CONTROL = 'public, max-age=31536000, s-maxage=31536000, immutable';

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (url.search.length > 200) return badRequest('query too long');
  const decoded = decodeShareGrid(url.searchParams);
  if (!decoded.ok) return badRequest(decoded.error);

  return new ImageResponse(<ResultImage grid={decoded.grid} />, {
    ...OG_SIZE,
    headers: { 'Cache-Control': IMAGE_CACHE_CONTROL },
  });
}

function badRequest(message: string): Response {
  return Response.json(
    { error: { code: 'bad_request', message } },
    { status: 400, headers: { 'Cache-Control': 'public, max-age=300, s-maxage=3600' } },
  );
}
