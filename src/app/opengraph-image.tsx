// Daily Open Graph image for "/" (Section 7.2): today's reel number over film grain. No puzzle data.
import { DAILY_IMAGE_ALT, renderDailyImage } from '@/components/share/og/dailyImageResponse';

export const alt = DAILY_IMAGE_ALT;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
// The reel number changes once a day at 00:00 New York time; refresh at most hourly.
export const revalidate = 3600;

export default async function Image() {
  return renderDailyImage();
}
