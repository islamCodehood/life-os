import type { AgeProfile } from '@/src/domain/identity/experience';
import type { ActivityReminderPolicy, ReminderRecord } from './entities';

export function defaultActivityReminderPolicy(profile: AgeProfile | null): ActivityReminderPolicy {
  switch (profile) {
    case 'EXPLORER':
    case 'BUILDER':
      return { systemReminderOffsetMinutes: 0 };
    case 'NAVIGATOR':
    case 'LAUNCH':
    case null:
      return { systemReminderOffsetMinutes: null };
  }
}

export function scheduledSystemReminderAt(
  targetAt: Date,
  policy: ActivityReminderPolicy,
): Date | null {
  if (policy.systemReminderOffsetMinutes === null) return null;
  return new Date(targetAt.getTime() + policy.systemReminderOffsetMinutes * 60_000);
}

export function isExternalReminderSource(source: ReminderRecord['source']): boolean {
  return source === 'SYSTEM' || source === 'GUARDIAN';
}

export function deliveredRemindersBefore(
  reminders: readonly ReminderRecord[],
  occurredAt: Date,
): ReminderRecord[] {
  return reminders.filter(
    (reminder) => reminder.deliveredAt !== null && reminder.deliveredAt <= occurredAt,
  );
}

export function classifyCompletionReminderEvidence(input: {
  reporter: 'CHILD' | 'GUARDIAN';
  occurredAt: Date;
  reminders: readonly ReminderRecord[];
}) {
  const delivered = deliveredRemindersBefore(input.reminders, input.occurredAt);
  const external = delivered.filter((reminder) => isExternalReminderSource(reminder.source));

  return {
    reminderCountAtCompletion: delivered.length,
    externalReminderCountAtCompletion: external.length,
    selfInitiated: input.reporter === 'CHILD' && external.length === 0,
  };
}
