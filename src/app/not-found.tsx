import { APP_NAME } from '@/config/brand';
import { PageHeader } from '@/components/chrome/PageHeader';
import { ButtonLink } from '@/components/ui/Button';
import { Accent } from '@/components/ui/Heading';

export default function NotFound() {
  return (
    <main className="l-page gl-page max-w-[720px]!">
      <p className="ty-label">Error 404</p>
      <PageHeader
        className="mt-2"
        title={
          <>
            Scene <Accent>missing</Accent>
          </>
        }
        lede="This page never made the final cut. Head back to today's film or browse the Vault."
      />
      <div className="mt-6 flex flex-wrap gap-3">
        <ButtonLink href="/" variant="slate" size="lg">
          {`Back to ${APP_NAME}`}
        </ButtonLink>
        <ButtonLink href="/vault">Open the Vault</ButtonLink>
      </div>
    </main>
  );
}
