import { APP_NAME } from '@/config/brand';
import { SceneHeading } from '@/components/chrome/SceneHeading';
import { SlateMeta } from '@/components/chrome/SlateMeta';
import { ButtonLink } from '@/components/ui/Button';
import { Accent } from '@/components/ui/Heading';

export default function NotFound() {
  return (
    <main className="l-page gl-page">
      <SlateMeta roll={404} scene={0} take={0} extra={['NG']} decorative />
      <div className="mt-6">
        <SceneHeading
          n="404"
          as="h1"
          size="lg"
          slug="INT. THE CUTTING ROOM FLOOR - NIGHT"
          title={
            <>
              Scene <Accent>missing</Accent>
            </>
          }
          meta="This page never made the final cut"
        />
      </div>
      <p className="ty-lede mt-8 text-ink-dim">
        The reel you asked for is not in the can. Head back to today&apos;s film or browse the Vault.
      </p>
      <div className="mt-8 flex flex-wrap gap-4">
        <ButtonLink href="/" variant="slate" size="lg">
          {`Back to ${APP_NAME}`}
        </ButtonLink>
        <ButtonLink href="/vault">Open the Vault</ButtonLink>
      </div>
    </main>
  );
}
