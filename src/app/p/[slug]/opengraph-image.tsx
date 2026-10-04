// Open Graph image for /p/[slug]: a generic pitch card. Never the film, never the slug.
import { DAILY_IMAGE_ALT, renderPitchImage } from '@/components/share/og/dailyImageResponse';

export const alt = DAILY_IMAGE_ALT;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return renderPitchImage();
}
