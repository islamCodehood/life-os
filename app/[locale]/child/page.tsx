import { Card } from '@life-os/design-system';
import { notFound, redirect } from 'next/navigation';
import { getIdentityMessages } from '@/src/i18n/identity-messages';
import { isLocale } from '@/src/i18n/locales';
import { currentServerRequest } from '@/src/infrastructure/auth/server-request';
import { createIdentityRuntime } from '@/src/infrastructure/composition/identity-runtime';

export const dynamic = 'force-dynamic';

export default async function ChildShellPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const messages = getIdentityMessages(locale);
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
        <span className="lo-app-foundation__eyebrow">{messages.childMode}</span>
        <h1>
          {messages.hello}, {child.displayName}
        </h1>
        <p>{messages.childScope}</p>
      </section>

      <Card className="lo-app-foundation__card" variant="soft">
        <strong>{messages.identityReady}</strong>
        <p>{messages.makeBedNext}</p>
      </Card>
    </main>
  );
}
