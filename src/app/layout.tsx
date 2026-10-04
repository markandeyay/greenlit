import type { Metadata, Viewport } from 'next';
import { Big_Shoulders, Courier_Prime, Instrument_Serif } from 'next/font/google';
import '@/styles/globals.css';
import { APP_NAME, APP_TAGLINE, SITE_URL } from '@/config/brand';
import { Footer } from '@/components/chrome/Footer';
import { Grain } from '@/components/chrome/Grain';
import { Leader } from '@/components/chrome/Leader';
import { Nav } from '@/components/chrome/Nav';
import { SettingsProvider } from '@/components/chrome/SettingsProvider';
import { SkipLink } from '@/components/chrome/SkipLink';
import { ToastProvider } from '@/components/ui/Toast';
import { SETTINGS_BOOT_SCRIPT } from '@/components/chrome/settings-boot';

// Three families, as on the SFA site (app/layout.tsx there): Big Shoulders for every title,
// Courier Prime for everything a script would carry (timecode, slate fields, labels, numbers),
// and Instrument Serif italic for the single accent word. Body text uses a system grotesk.

/* The poster face: squared signage letters, variable weight and optical size. */
const display = Big_Shoulders({
  subsets: ['latin'],
  weight: 'variable',
  axes: ['opsz'],
  variable: '--font-display',
  display: 'swap',
  // next/font has no metric overrides for Big Shoulders; fall back to a condensed system face.
  adjustFontFallback: false,
  fallback: ['Impact', 'Arial Narrow', 'sans-serif'],
});

/* The screenplay face: Courier Prime, the Courier cut drawn for scripts. */
const mono = Courier_Prime({
  subsets: ['latin'],
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  variable: '--font-mono',
  display: 'swap',
});

/* The accent: one italic serif word inside a bold condensed heading. */
const serif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['italic', 'normal'],
  variable: '--font-serif',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: APP_TAGLINE,
  applicationName: APP_NAME,
  openGraph: { siteName: APP_NAME, type: 'website', title: APP_NAME, description: APP_TAGLINE },
};

export const viewport: Viewport = {
  themeColor: '#0e0d0c',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${mono.variable} ${serif.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Applies colorblind / reduced-motion settings before first paint. */}
        <script dangerouslySetInnerHTML={{ __html: SETTINGS_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <SettingsProvider />
        <ToastProvider>
          <SkipLink targetId="content" />
          <Nav />
          {/* Pages render their own <main>; this wrapper is the skip-link target. */}
          <div id="content" tabIndex={-1} className="flex-1 outline-none">
            {children}
          </div>
          <Footer />
        </ToastProvider>
        <Grain />
        <Leader />
      </body>
    </html>
  );
}
