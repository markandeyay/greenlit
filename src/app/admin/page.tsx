// /admin (Section 3, WS8): puzzle scheduling and film library tools. Auth gated on the server:
// admins (ADMIN_EMAILS via getCurrentUser) always, and anyone under `pnpm dev`
// (NODE_ENV === 'development', a local convenience documented in src/server/admin/access.ts).
// Everyone else sees a sign-in screen and no data. This is the only page that shows answers.
import type { Metadata } from 'next';
import Link from 'next/link';
import { APP_NAME } from '@/config/brand';
import { addDays, dateInResetZone } from '@/lib/dates';
import { getAdminAccess } from '@/server/admin/access';
import { Breadcrumb } from '@/components/chrome/Breadcrumb';
import { SlateMeta } from '@/components/chrome/SlateMeta';
import { Accent } from '@/components/ui/Heading';
import { ButtonLink } from '@/components/ui/Button';
import { AdminConsole } from '@/components/admin/AdminConsole';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const access = await getAdminAccess();
  const today = dateInResetZone();

  return (
    <main className="l-page gl-page pb-16">
      <Breadcrumb items={[{ label: APP_NAME, href: '/' }, { label: 'Admin' }]} />
      <div className="mt-8">
        <SlateMeta roll={today.slice(0, 4)} extra={['Production office']} decorative />
        <h1 className="ty-display mt-3 text-[length:var(--t-d2)]">
          Production <Accent>office</Accent>
        </h1>
      </div>

      {!access.allowed ? (
        <div className="mt-8 max-w-xl">
          <p className="ty-lede text-ink-dim">
            This door is for the crew. Sign in with an admin account to schedule reels and edit the film library.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href="/settings" variant="solid">
              Sign in
            </ButtonLink>
            <Link href="/" className="self-center underline">
              Back to today&apos;s reel
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-8 grid gap-6">
          {access.devBypass ? (
            <p className="border-l-2 border-ink pl-3 font-mono text-sm">
              Development mode: the admin is open without sign-in on this machine. Production requires an admin account.
            </p>
          ) : null}
          <p className="text-sm text-ink-dim">Answers are visible on this page. Do not screen share it.</p>
          <AdminConsole tomorrow={addDays(today, 1)} />
        </div>
      )}
    </main>
  );
}
