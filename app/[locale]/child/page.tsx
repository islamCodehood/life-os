import { Card } from '@life-os/design-system';
import { redirect } from 'next/navigation';
import { currentServerRequest } from '@/src/infrastructure/auth/server-request';
import { createIdentityRuntime } from '@/src/infrastructure/composition/identity-runtime';

export const dynamic = 'force-dynamic';

export default async function ChildShellPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const runtime = await createIdentityRuntime();
  const actor = await runtime.actorResolver.resolve(await currentServerRequest(`/${locale}/child`));

  if (!actor || actor.kind !== 'CHILD') {
    redirect(`/${locale}`);
  }

  const child = await runtime.repository.getChild(actor.familyId, actor.childId);
  if (!child) redirect(`/${locale}`);

  return (
    <main className="lo-app-foundation">
      <section className="lo-app-foundation__hero">
        <span className="lo-app-foundation__eyebrow">Child mode</span>
        <h1>Hi, {child.displayName}</h1>
        <p>Your child-scoped session can only access your own private Life OS data.</p>
      </section>

      <Card className="lo-app-foundation__card" variant="soft">
        <strong>Identity foundation ready</strong>
        <p>The Make Bed responsibility arrives in Epic 2.</p>
      </Card>
    </main>
  );
}
