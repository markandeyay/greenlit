// Daily share links (Section 7.1): /<reelNumber>. Today's reel goes to "/", released past reels to
// the Vault, anything else is a 404. Static top-level routes (/vault, /pitch, ...) win over this
// dynamic segment in the App Router.
import { notFound, redirect } from 'next/navigation';
import { todayPuzzleNumber } from '@/lib/dates';

export const dynamic = 'force-dynamic';

export default async function ReelLinkPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  if (!/^\d{1,6}$/.test(number)) notFound();
  const n = Number(number);
  const today = todayPuzzleNumber();
  if (n < 1 || n > today) notFound();
  if (n === today) redirect('/');
  redirect(`/vault/${n}`);
}
