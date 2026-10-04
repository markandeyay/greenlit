// Placeholder (WS0). Owned by WS5.
import { APP_NAME, APP_TAGLINE } from '@/config/brand';

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl p-4">
      <h1 className="font-display text-4xl uppercase">{APP_NAME}</h1>
      <p className="text-ink-dim">{APP_TAGLINE}</p>
    </main>
  );
}
