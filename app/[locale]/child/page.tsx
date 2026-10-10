import { notFound, redirect } from 'next/navigation';
import { getActivityMessages } from '@/src/i18n/activity-messages';
import { getGoalMessages } from '@/src/i18n/goal-messages';
import { getMoneyMessages } from '@/src/i18n/money-messages';
import { MoneyPanel } from '@/src/ui/money/MoneyPanel';
import { GoalsPanel } from '@/src/ui/goals/GoalsPanel';
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
  const goalItems = await runtime.goals.listVisible(actor);
  const goalHistory = Object.fromEntries(
    await Promise.all(
      goalItems.map(
        async (item) => [item.id, await runtime.goals.history(actor, item.id)] as const,
      ),
    ),
  );
  const moneyJobs = await runtime.jobs.listVisible(actor);
  const moneyWallet = await runtime.money.view(actor, actor.childId);
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
      <MoneyPanel
        mode="CHILD"
        profiles={[
          {
            id: actor.childId,
            displayName: child.displayName,
            jobs: moneyJobs,
            wallet: moneyWallet,
          },
        ]}
        messages={getMoneyMessages(locale)}
      />
      <GoalsPanel
        mode="CHILD"
        childId={actor.childId}
        goals={goalItems}
        history={goalHistory}
        childProfiles={[]}
        messages={getGoalMessages(locale)}
      />
    </main>
  );
}
