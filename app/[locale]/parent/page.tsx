import { Button, Card } from '@life-os/design-system';
import { notFound, redirect } from 'next/navigation';
import { currentDateInTimezone } from '@/src/application/identity/current-date';
import { getIdentityMessages } from '@/src/i18n/identity-messages';
import { isLocale } from '@/src/i18n/locales';
import { currentServerRequest } from '@/src/infrastructure/auth/server-request';
import { createIdentityRuntime } from '@/src/infrastructure/composition/identity-runtime';
import { ParentIdentitySetup } from '@/src/ui/identity/ParentIdentitySetup';

export const dynamic = 'force-dynamic';

export default async function ParentShellPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const messages = getIdentityMessages(locale);
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
        <span className="lo-app-foundation__eyebrow">{messages.parentMode}</span>
        <h1>{family?.name ?? 'Life OS'}</h1>
        <p>{messages.identityActive}</p>
      </section>

      <Card className="lo-app-foundation__card" variant="soft">
        <strong>{messages.children}</strong>
        <p>
          {children.length === 0
            ? messages.noChildren
            : children.map((child) => child.displayName).join(' · ')}
        </p>
        <form action={`/${locale}`}>
          <Button type="submit">{messages.switchProfile}</Button>
        </form>
      </Card>

      <ParentIdentitySetup
        childProfiles={children.map((child) => ({ id: child.id, displayName: child.displayName }))}
        messages={messages}
      />
    </main>
  );
}
