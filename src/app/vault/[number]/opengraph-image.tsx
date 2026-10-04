// Open Graph image for /vault/[number]: "Reel N" over film grain. No puzzle data.
import { DAILY_IMAGE_ALT, renderVaultImage } from '@/components/share/og/dailyImageResponse';

export const alt = DAILY_IMAGE_ALT;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const revalidate = 3600;

export default async function Image({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  return renderVaultImage(number);
}
