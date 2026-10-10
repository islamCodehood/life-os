import { Button, Card } from '@life-os/design-system';
import { notFound, redirect } from 'next/navigation';
import { currentDateInTimezone } from '@/src/application/identity/current-date';
import { getActivityMessages } from '@/src/i18n/activity-messages';
import { getGoalMessages } from '@/src/i18n/goal-messages';
import { getMoneyMessages } from '@/src/i18n/money-messages';
import { MoneyPanel } from '@/src/ui/money/MoneyPanel';
import { GoalsPanel } from '@/src/ui/goals/GoalsPanel';
import { getIdentityMessages } from '@/src/i18n/identity-messages';
import { isLocale } from '@/src/i18n/locales';
import { currentServerRequest } from '@/src/infrastructure/auth/server-request';
import { createActivityRuntime } from '@/src/infrastructure/composition/activity-runtime';
import { ParentMakeBedPanel } from '@/src/ui/activity/ParentMakeBedPanel';
import { ParentGrowthPanel } from '@/src/ui/growth/ParentGrowthPanel';
import { ParentGraduationPanel } from '@/src/ui/graduation/ParentGraduationPanel';
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
      const [assignment, history, insight, graduation] = await Promise.all([
        runtime.activityRepository.findActiveAssignmentByTemplate(
          actor.familyId,
          child.id,
          'SELF_MAKE_BED',
        ),
        runtime.activities.getParentHistory(actor, child.id),
        runtime.activities.getParentMakeBedInsight(actor, child.id),
        runtime.graduations.parentOverview(actor, child.id),
      ]);

      return {
        id: child.id,
        displayName: child.displayName,
        assigned: graduation !== null,
        ...(assignment ? { activeFrom: assignment.activeFrom } : {}),
        history: history.map((entry) => ({
          id: entry.completion.id,
          label: formatter.format(entry.completion.occurredAt),
          selfInitiated: entry.completion.selfInitiated,
        })),
        graduation,
        evidence: insight
          ? {
              coverageComplete: insight.metrics.coverageComplete,
              applicableOpportunities: insight.metrics.applicableOpportunities,
              recoveryOpen: insight.metrics.recoveryOpen,
            }
          : null,
        insight: insight
          ? {
              metrics: insight.metrics,
              unresolved: insight.unresolved.map((entry) => ({
                id: entry.id,
                version: entry.version,
                label: formatter.format(new Date(entry.targetAt)),
              })),
            }
          : null,
      };
    }),
  );

  const growthChildren = await Promise.all(
    childProfiles.map(async (child) => {
      const [reading, chess, skills, xpEntries] = await Promise.all([
        runtime.activityRepository.findActiveAssignmentByTemplate(
          actor.familyId,
          child.id,
          'GROWTH_READING',
        ),
        runtime.activityRepository.findActiveAssignmentByTemplate(
          actor.familyId,
          child.id,
          'GROWTH_CHESS_PRACTICE',
        ),
        runtime.activities.getChildSkillProgress(actor, child.id),
        runtime.activities.getParentXpHistory(actor, child.id),
      ]);
      return {
        id: child.id,
        displayName: child.displayName,
        readingAssigned: reading !== null,
        chessAssigned: chess !== null,
        skills,
        xpHistory: xpEntries.map((entry) => ({
          id: entry.id,
          skillKey: entry.skillKey,
          entryType: entry.entryType,
          amount: entry.amount,
          correctionOf: entry.correctionOf,
          occurredAt: entry.occurredAt.toISOString(),
        })),
      };
    }),
  );

  const goalItems = await runtime.goals.listVisible(actor);
  const goalHistory = Object.fromEntries(
    await Promise.all(
      goalItems.map(
        async (item) => [item.id, await runtime.goals.history(actor, item.id)] as const,
      ),
    ),
  );

  const moneyChildren = await Promise.all(childProfiles.map(async child=>({
    id:child.id,displayName:child.displayName,
    jobs:await runtime.jobs.listVisible(actor,child.id),
    wallet:await runtime.money.view(actor,child.id),
  })));

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

      <ParentMakeBedPanel
        childProfiles={pilotChildren}
        messages={activityMessages}
        locale={locale}
      />
      <ParentGraduationPanel childProfiles={pilotChildren} messages={activityMessages} />
      <ParentGrowthPanel childProfiles={growthChildren} messages={activityMessages} />
      <MoneyPanel mode="GUARDIAN" children={moneyChildren} messages={getMoneyMessages(locale)} />
      <GoalsPanel
        mode="GUARDIAN"
        goals={goalItems}
        history={goalHistory}
        childProfiles={childProfiles.map((child) => ({
          id: child.id,
          displayName: child.displayName,
        }))}
        messages={getGoalMessages(locale)}
      />
    </main>
  );
}
