import type { Metadata } from 'next';
import '@/styles/globals.css';
import { APP_NAME, APP_TAGLINE, SITE_URL } from '@/config/brand';

// WS4 owns fonts (next/font, max 3 families) and the chrome (Nav, Footer, Leader).

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: APP_TAGLINE,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
