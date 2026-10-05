import { Button, Card } from '@life-os/design-system';
import { notFound, redirect } from 'next/navigation';
import { currentDateInTimezone } from '@/src/application/identity/current-date';
import { getActivityMessages } from '@/src/i18n/activity-messages';
import { getIdentityMessages } from '@/src/i18n/identity-messages';
import { isLocale } from '@/src/i18n/locales';
import { currentServerRequest } from '@/src/infrastructure/auth/server-request';
import { createActivityRuntime } from '@/src/infrastructure/composition/activity-runtime';
import { ParentMakeBedPanel } from '@/src/ui/activity/ParentMakeBedPanel';
import { ParentIdentitySetup } from '@/src/ui/identity/ParentIdentitySetup';

export const dynamic = 'force-dynamic';

export default async function ParentShellPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const identityMessages = getIdentityMessages(locale);
  const activityMessages = getActivityMessages(locale);
  const runtime = await createActivityRuntime();
  const actor = await runtime.actorResolver.resolve(
    await currentServerRequest(`/${locale}/parent`),
  );

  if (!actor || actor.kind !== 'GUARDIAN') {
    redirect(`/${locale}?parent=locked`);
  }

  const family = await runtime.repository.getFamily(actor.familyId);
  const childProfiles = family
    ? await runtime.repository.listChildSummaries(
        actor.familyId,
        currentDateInTimezone(family.timezone),
      )
    : [];

  const formatter = new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'en', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: family?.timezone ?? 'UTC',
  });

  const pilotChildren = await Promise.all(
    childProfiles.map(async (child) => {
      const [assignment, history] = await Promise.all([
        runtime.activityRepository.findActiveAssignmentByTemplate(
          actor.familyId,
          child.id,
          'SELF_MAKE_BED',
        ),
        runtime.activities.getParentHistory(actor, child.id),
      ]);

      return {
        id: child.id,
        displayName: child.displayName,
        assigned: assignment !== null,
        ...(assignment ? { activeFrom: assignment.activeFrom } : {}),
        history: history.map((entry) => ({
          id: entry.completion.id,
          label: formatter.format(entry.completion.occurredAt),
          selfInitiated: entry.completion.selfInitiated,
        })),
      };
    }),
  );

  return (
    <main className="lo-app-foundation">
      <section className="lo-app-foundation__hero">
        <span className="lo-app-foundation__eyebrow">{identityMessages.parentMode}</span>
        <h1>{family?.name ?? 'Life OS'}</h1>
        <p>{identityMessages.identityActive}</p>
      </section>

      <Card className="lo-app-foundation__card" variant="soft">
        <strong>{identityMessages.children}</strong>
        <p>
          {childProfiles.length === 0
            ? identityMessages.noChildren
            : childProfiles.map((child) => child.displayName).join(' · ')}
        </p>
        <form action={`/${locale}`}>
          <Button type="submit">{identityMessages.switchProfile}</Button>
        </form>
      </Card>

      <ParentIdentitySetup
        childProfiles={childProfiles.map((child) => ({
          id: child.id,
          displayName: child.displayName,
        }))}
        messages={identityMessages}
      />

      <ParentMakeBedPanel childProfiles={pilotChildren} messages={activityMessages} />
    </main>
  );
}
