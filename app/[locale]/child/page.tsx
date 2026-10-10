import { notFound, redirect } from 'next/navigation';
import { getActivityMessages } from '@/src/i18n/activity-messages';
import { getIdentityMessages } from '@/src/i18n/identity-messages';
import { isLocale } from '@/src/i18n/locales';
import { currentServerRequest } from '@/src/infrastructure/auth/server-request';
import { createActivityRuntime } from '@/src/infrastructure/composition/activity-runtime';
import { childOfflineActorScope } from '@/src/offline/actor-scope';
import { ChildTodayResponsibilities } from '@/src/ui/activity/ChildTodayResponsibilities';
import { ChildGraduatedResponsibilities } from '@/src/ui/graduation/ChildGraduatedResponsibilities';
import { ChildSkillProgress } from '@/src/ui/growth/ChildSkillProgress';

export const dynamic = 'force-dynamic';

export default async function ChildShellPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const identityMessages = getIdentityMessages(locale);
  const activityMessages = getActivityMessages(locale);
  const runtime = await createActivityRuntime();
  const actor = await runtime.actorResolver.resolve(await currentServerRequest(`/${locale}/child`));

  if (!actor || actor.kind !== 'CHILD') {
    redirect(`/${locale}`);
  }

  const child = await runtime.repository.getChild(actor.familyId, actor.childId);
  if (!child) redirect(`/${locale}`);

  const today = await runtime.activities.getChildToday(actor);
  const graduated = await runtime.graduations.childGraduated(actor);
  const skills = await runtime.activities.getChildSkillProgress(actor, actor.childId);
  const actorScope = childOfflineActorScope({
    familyId: actor.familyId,
    childId: actor.childId,
    deviceId: actor.deviceId,
  });

  return (
    <main className="lo-app-foundation">
      <section className="lo-app-foundation__hero">
        <span className="lo-app-foundation__eyebrow">{identityMessages.childMode}</span>
        <h1>
          {identityMessages.hello}, {child.displayName}
        </h1>
        <p>{identityMessages.childScope}</p>
      </section>

      <ChildTodayResponsibilities
        items={today.sections.flatMap((section) => section.items)}
        messages={activityMessages}
        referenceTime={today.generatedAt}
        actorScope={actorScope}
      />
      <ChildGraduatedResponsibilities items={graduated} messages={activityMessages} />
      <ChildSkillProgress skills={skills} messages={activityMessages} />
    </main>
  );
}
