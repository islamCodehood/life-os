import type { ActivityInstanceStatus, CompletionRecord, ReminderRecord } from './entities';
import { deliveredRemindersBefore, isExternalReminderSource } from './reminder';

export interface ActivityOpportunityEvidence {
  instanceId: string;
  version: number;
  status: ActivityInstanceStatus;
  targetAt: Date;
  opportunityEndsAt: Date;
  completion: CompletionRecord | null;
  reminders: ReminderRecord[];
}

export interface ActivityProgressMetrics {
  applicableOpportunities: number;
  resolvedOpportunities: number;
  completedOpportunities: number;
  missedOpportunities: number;
  unresolvedOpportunities: number;
  excusedOpportunities: number;
  notApplicableOpportunities: number;
  consistencyRate: number | null;
  completionRate: number | null;
  dataCoverage: number | null;
  selfInitiationRate: number | null;
  reminderDependencyRate: number | null;
  averageRemindersPerOpportunity: number | null;
  onTimeRate: number | null;
  recoveryOpen: boolean;
  latestRecoveryLatency: number | null;
  recoveredOnNextOpportunity: boolean;
  coverageAllowsReadinessEvaluation: boolean;
}

const applicableStatuses = new Set<ActivityInstanceStatus>([
  'COMPLETED',
  'MISSED',
  'AWAITING_RESOLUTION',
]);

function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

function sortedEvidence(
  evidence: readonly ActivityOpportunityEvidence[],
): ActivityOpportunityEvidence[] {
  return [...evidence].sort((left, right) => left.targetAt.getTime() - right.targetAt.getTime());
}

function isApplicable(opportunity: ActivityOpportunityEvidence): boolean {
  return applicableStatuses.has(opportunity.status);
}

function deliveredForOpportunity(opportunity: ActivityOpportunityEvidence): ReminderRecord[] {
  const through = opportunity.completion?.occurredAt ?? opportunity.opportunityEndsAt;
  return deliveredRemindersBefore(opportunity.reminders, through);
}

export function recoveryLatencyForCompletion(
  evidence: readonly ActivityOpportunityEvidence[],
  completionInstanceId: string,
): number | null {
  let recoveryOpen = false;
  let elapsedValidOpportunities = 0;

  for (const opportunity of sortedEvidence(evidence)) {
    if (!isApplicable(opportunity)) continue;

    if (opportunity.status === 'MISSED') {
      recoveryOpen = true;
      elapsedValidOpportunities = 0;
      continue;
    }

    if (!recoveryOpen) continue;

    if (opportunity.status === 'AWAITING_RESOLUTION') {
      elapsedValidOpportunities += 1;
      continue;
    }

    if (opportunity.status === 'COMPLETED') {
      const latency = elapsedValidOpportunities + 1;
      if (opportunity.instanceId === completionInstanceId) return latency;
      recoveryOpen = false;
      elapsedValidOpportunities = 0;
    }
  }

  return null;
}

export function calculateActivityProgress(
  evidence: readonly ActivityOpportunityEvidence[],
): ActivityProgressMetrics {
  const ordered = sortedEvidence(evidence);
  const applicable = ordered.filter(isApplicable);
  const resolved = applicable.filter(
    (opportunity) => opportunity.status === 'COMPLETED' || opportunity.status === 'MISSED',
  );
  const completed = applicable.filter((opportunity) => opportunity.status === 'COMPLETED');
  const missed = applicable.filter((opportunity) => opportunity.status === 'MISSED');
  const unresolved = applicable.filter(
    (opportunity) => opportunity.status === 'AWAITING_RESOLUTION',
  );
  const excused = ordered.filter((opportunity) => opportunity.status === 'EXCUSED');
  const notApplicable = ordered.filter((opportunity) => opportunity.status === 'NOT_APPLICABLE');

  const selfInitiated = completed.filter(
    (opportunity) => opportunity.completion?.selfInitiated === true,
  ).length;

  const externallyPrompted = completed.filter((opportunity) => {
    if (!opportunity.completion) return false;
    return deliveredRemindersBefore(opportunity.reminders, opportunity.completion.occurredAt).some(
      (reminder) => isExternalReminderSource(reminder.source),
    );
  }).length;

  const deliveredReminderCount = applicable.reduce(
    (sum, opportunity) => sum + deliveredForOpportunity(opportunity).length,
    0,
  );

  const onTime = completed.filter(
    (opportunity) =>
      opportunity.completion !== null && opportunity.completion.occurredAt <= opportunity.targetAt,
  ).length;

  let recoveryOpen = false;
  let elapsedValidOpportunities = 0;
  let latestRecoveryLatency: number | null = null;

  for (const opportunity of applicable) {
    if (opportunity.status === 'MISSED') {
      recoveryOpen = true;
      elapsedValidOpportunities = 0;
      continue;
    }

    if (!recoveryOpen) continue;

    if (opportunity.status === 'AWAITING_RESOLUTION') {
      elapsedValidOpportunities += 1;
      continue;
    }

    if (opportunity.status === 'COMPLETED') {
      latestRecoveryLatency = elapsedValidOpportunities + 1;
      recoveryOpen = false;
      elapsedValidOpportunities = 0;
    }
  }

  const dataCoverage = ratio(resolved.length, applicable.length);

  return {
    applicableOpportunities: applicable.length,
    resolvedOpportunities: resolved.length,
    completedOpportunities: completed.length,
    missedOpportunities: missed.length,
    unresolvedOpportunities: unresolved.length,
    excusedOpportunities: excused.length,
    notApplicableOpportunities: notApplicable.length,
    consistencyRate: ratio(completed.length, resolved.length),
    completionRate: ratio(completed.length, applicable.length),
    dataCoverage,
    selfInitiationRate: ratio(selfInitiated, applicable.length),
    reminderDependencyRate: ratio(externallyPrompted, applicable.length),
    averageRemindersPerOpportunity: ratio(deliveredReminderCount, applicable.length),
    onTimeRate: ratio(onTime, completed.length),
    recoveryOpen,
    latestRecoveryLatency,
    recoveredOnNextOpportunity: latestRecoveryLatency === 1,
    coverageAllowsReadinessEvaluation: applicable.length > 0 && dataCoverage === 1,
  };
}
