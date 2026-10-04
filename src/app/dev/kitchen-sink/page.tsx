import type { Metadata } from 'next';
import { APP_NAME } from '@/config/brand';
import { Breadcrumb } from '@/components/chrome/Breadcrumb';
import { KitchenSink } from '@/components/chrome/KitchenSink';
import { Accent } from '@/components/ui/Heading';

export const metadata: Metadata = {
  title: 'Kitchen sink',
  robots: { index: false, follow: false },
};

export default function KitchenSinkPage() {
  return (
    <main className="l-page gl-page">
      <Breadcrumb items={[{ label: APP_NAME, href: '/' }, { label: 'Dev' }, { label: 'Kitchen sink' }]} />
      <h1 className="ty-display mt-8 text-[length:var(--t-d1)]">
        Kitchen <Accent>sink</Accent>
      </h1>
      <p className="ty-lede mt-4 text-ink-dim">Every design system component and state, on one stage.</p>
      <KitchenSink />
    </main>
  );
}
