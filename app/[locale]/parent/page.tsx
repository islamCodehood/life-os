import { Button, Card } from '@life-os/design-system';
import { redirect } from 'next/navigation';
import { currentDateInTimezone } from '@/src/application/identity/current-date';
import { currentServerRequest } from '@/src/infrastructure/auth/server-request';
import { createIdentityRuntime } from '@/src/infrastructure/composition/identity-runtime';

export const dynamic = 'force-dynamic';

export default async function ParentShellPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const runtime = await createIdentityRuntime();
  const actor = await runtime.actorResolver.resolve(
    await currentServerRequest(`/${locale}/parent`),
  );

  if (!actor || actor.kind !== 'GUARDIAN') {
    redirect(`/${locale}?parent=locked`);
  }

  const family = await runtime.repository.getFamily(actor.familyId);
  const children = family
    ? await runtime.repository.listChildSummaries(
        actor.familyId,
        currentDateInTimezone(family.timezone),
      )
    : [];

  return (
    <main className="lo-app-foundation">
      <section className="lo-app-foundation__hero">
        <span className="lo-app-foundation__eyebrow">Parent mode</span>
        <h1>{family?.name ?? 'Life OS'}</h1>
        <p>Family identity and shared-device administration are active.</p>
      </section>

      <Card className="lo-app-foundation__card" variant="soft">
        <strong>Children</strong>
        <p>
          {children.length === 0
            ? 'No child profiles yet.'
            : children.map((child) => child.displayName).join(' · ')}
        </p>
        <form action={`/${locale}`}>
          <Button type="submit">Switch profile</Button>
        </form>
      </Card>
    </main>
  );
}
