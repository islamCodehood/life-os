import { and, eq, gt, gte, inArray, isNull, lt, lte, or, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { newId } from '@/src/domain/shared/id';
import type { ActorContext } from '@/src/application/auth/actor-context';
import {
  backoffMinutes,
  canSend,
  defaultPreference,
  safeTarget,
  validClock,
  type NotificationKind,
  type NotificationPreference,
} from '@/src/domain/notifications/policy';
import { assertPushEndpoint, sendPush } from './web-push';
import * as s from '@/src/infrastructure/database/schema';
type Db = NodePgDatabase<typeof s>;
export class NotificationError extends Error {
  constructor(
    readonly code: 'FORBIDDEN' | 'DOMAIN_RULE_VIOLATION' | 'RESOURCE_STATE_CHANGED',
    message: string,
  ) {
    super(message);
    this.name = 'NotificationError';
  }
}
function actorKey(actor: ActorContext): string {
  if (actor.kind === 'SYSTEM') throw new NotificationError('FORBIDDEN', 'Family actor required.');
  return actor.kind + ':' + (actor.kind === 'CHILD' ? actor.childId : actor.guardianId);
}
function scope(actor: ActorContext) {
  if (actor.kind === 'SYSTEM') throw new NotificationError('FORBIDDEN', 'Family actor required.');
  return { familyId: actor.familyId, actorKey: actorKey(actor) };
}
export class Notifications {
  constructor(private readonly db: Db) {}
  async view(actor: ActorContext) {
    const x = scope(actor);
    const [p] = await this.db
      .select()
      .from(s.notificationPreferences)
      .where(
        and(
          eq(s.notificationPreferences.familyId, x.familyId),
          eq(s.notificationPreferences.actorKey, x.actorKey),
        ),
      )
      .limit(1);
    const subs = await this.db
      .select({ id: s.pushSubscriptions.id })
      .from(s.pushSubscriptions)
      .where(
        and(
          eq(s.pushSubscriptions.familyId, x.familyId),
          eq(s.pushSubscriptions.actorKey, x.actorKey),
        ),
      );
    return {
      preference: p
        ? { enabled: p.enabled, quietStart: p.quietStart, quietEnd: p.quietEnd }
        : defaultPreference,
      subscriptions: subs.length,
      configured: Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
    };
  }
  async setPreferences(actor: ActorContext, p: NotificationPreference) {
    const x = scope(actor);
    if (!validClock(p.quietStart) || !validClock(p.quietEnd))
      throw new NotificationError('DOMAIN_RULE_VIOLATION', 'Invalid quiet-hours clock.');
    await this.db
      .insert(s.notificationPreferences)
      .values({ ...x, ...p })
      .onConflictDoUpdate({
        target: [s.notificationPreferences.familyId, s.notificationPreferences.actorKey],
        set: { ...p, updatedAt: new Date() },
      });
    return this.view(actor);
  }
  async subscribe(
    actor: ActorContext,
    data: { endpoint: string; keys: { p256dh: string; auth: string } },
  ) {
    const x = scope(actor);
    let endpoint: string;
    try {
      endpoint = assertPushEndpoint(data.endpoint);
    } catch {
      throw new NotificationError('DOMAIN_RULE_VIOLATION', 'Untrusted push service.');
    }
    if (data.keys.p256dh.length > 300 || data.keys.auth.length > 300)
      throw new NotificationError('DOMAIN_RULE_VIOLATION', 'Invalid push keys.');
    await this.db
      .insert(s.notificationPreferences)
      .values({ ...x, ...defaultPreference })
      .onConflictDoNothing();
    const existing = await this.db
      .select()
      .from(s.pushSubscriptions)
      .where(eq(s.pushSubscriptions.endpoint, endpoint))
      .limit(1);
    if (existing[0] && (existing[0].familyId !== x.familyId || existing[0].actorKey !== x.actorKey))
      throw new NotificationError(
        'RESOURCE_STATE_CHANGED',
        'This device is linked to a different profile. Unsubscribe there first.',
      );
    const owned = await this.db
      .select({ id: s.pushSubscriptions.id })
      .from(s.pushSubscriptions)
      .where(
        and(
          eq(s.pushSubscriptions.familyId, x.familyId),
          eq(s.pushSubscriptions.actorKey, x.actorKey),
        ),
      );
    if (!existing[0] && owned.length >= 3)
      throw new NotificationError('DOMAIN_RULE_VIOLATION', 'Maximum three devices per profile.');
    if (existing[0]) {
      await this.db
        .update(s.pushSubscriptions)
        .set({ p256dh: data.keys.p256dh, authSecret: data.keys.auth, updatedAt: new Date() })
        .where(eq(s.pushSubscriptions.id, existing[0].id));
    } else {
      await this.db
        .insert(s.pushSubscriptions)
        .values({
          id: newId<'PushSubscriptionId'>(),
          ...x,
          endpoint,
          p256dh: data.keys.p256dh,
          authSecret: data.keys.auth,
        });
    }
    return this.view(actor);
  }
  async unsubscribe(actor: ActorContext, endpoint: string) {
    const x = scope(actor);
    await this.db
      .delete(s.pushSubscriptions)
      .where(
        and(
          eq(s.pushSubscriptions.familyId, x.familyId),
          eq(s.pushSubscriptions.actorKey, x.actorKey),
          eq(s.pushSubscriptions.endpoint, endpoint),
        ),
      );
    return this.view(actor);
  }
  private async intent(input: {
    familyId: string;
    actorKey: string;
    kind: NotificationKind;
    sourceKey: string;
    dueAt: Date;
    targetPath: string;
  }) {
    await this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(s.notificationIntents)
        .values({
          id: newId<'NotificationIntentId'>(),
          ...input,
        })
        .onConflictDoNothing({
          target: [
            s.notificationIntents.familyId,
            s.notificationIntents.actorKey,
            s.notificationIntents.sourceKey,
          ],
        })
        .returning({ id: s.notificationIntents.id });
      if (!created) return;
      await tx.insert(s.outboxMessages).values({
        id: newId<'OutboxId'>(),
        familyId: input.familyId,
        intentId: created.id,
        availableAt: input.dueAt > new Date() ? input.dueAt : new Date(),
      });
    });
  }
  async schedule(
    now = new Date(),
  ): Promise<{ reminders: number; monitoring: number; suggestions: number }> {
    const r = { reminders: 0, monitoring: 0, suggestions: 0 };
    const validFrom = new Date(now.getTime() - 75 * 60_000);
    const reminderRows = await this.db
      .select({
        familyId: s.reminderRecords.familyId,
        reminderId: s.reminderRecords.id,
        scheduledFor: s.reminderRecords.scheduledFor,
        childId: s.activityInstances.childId,
        timezone: s.families.timezone,
      })
      .from(s.reminderRecords)
      .innerJoin(
        s.activityInstances,
        and(
          eq(s.reminderRecords.activityInstanceId, s.activityInstances.id),
          eq(s.reminderRecords.familyId, s.activityInstances.familyId),
        ),
      )
      .innerJoin(
        s.activityAssignments,
        and(
          eq(s.activityInstances.assignmentId, s.activityAssignments.id),
          eq(s.activityInstances.familyId, s.activityAssignments.familyId),
        ),
      )
      .innerJoin(s.families, eq(s.families.id, s.reminderRecords.familyId))
      .where(
        and(
          eq(s.reminderRecords.source, 'SYSTEM'),
          isNull(s.reminderRecords.attemptedAt),
          eq(s.activityInstances.status, 'PENDING'),
          eq(s.activityAssignments.status, 'ACTIVE'),
          lte(s.reminderRecords.scheduledFor, now),
          gte(s.reminderRecords.scheduledFor, validFrom),
        ),
      )
      .limit(250);
    const shared = await this.db
      .select({
        familyId: s.notificationPreferences.familyId,
        actorKey: s.notificationPreferences.actorKey,
        enabled: s.notificationPreferences.enabled,
        quietStart: s.notificationPreferences.quietStart,
        quietEnd: s.notificationPreferences.quietEnd,
        timezone: s.families.timezone,
      })
      .from(s.notificationPreferences)
      .innerJoin(s.families, eq(s.families.id, s.notificationPreferences.familyId))
      .where(eq(s.notificationPreferences.enabled, true));
    const eligible = new Map(shared.map((p) => [p.familyId + ':' + p.actorKey, p]));
    for (const row of reminderRows) {
      const key = 'CHILD:' + row.childId;
      const p = eligible.get(row.familyId + ':' + key);
      if (!p || !canSend(now, p.timezone, p)) continue;
      await this.intent({
        familyId: row.familyId,
        actorKey: key,
        kind: 'ACTIVITY_REMINDER',
        sourceKey: 'reminder:' + row.reminderId,
        dueAt: row.scheduledFor,
        targetPath: safeTarget('en', 'CHILD'),
      });
      r.reminders++;
    }
    // Monitoring is a guardian check-in, not a child failure, and never reactivates a responsibility.
    const records = await this.db
      .select({
        id: s.graduationRecords.id,
        familyId: s.graduationRecords.familyId,
        approvedAt: s.graduationRecords.approvedAt,
        lastObservedAt: s.graduationRecords.lastObservedAt,
        days: s.graduationRecords.monitoringIntervalDays,
      })
      .from(s.graduationRecords)
      .where(eq(s.graduationRecords.status, 'GRADUATED'))
      .limit(250);
    for (const record of records) {
      const due = new Date(
        (record.lastObservedAt ?? record.approvedAt).getTime() + record.days * 86400_000,
      );
      if (due > now) continue;
      const cycle = Math.floor((now.getTime() - due.getTime()) / 86400_000);
      for (const pref of shared.filter(
        (p) => p.familyId === record.familyId && p.actorKey.startsWith('GUARDIAN:'),
      )) {
        if (!canSend(now, pref.timezone, pref)) continue;
        await this.intent({
          familyId: record.familyId,
          actorKey: pref.actorKey,
          kind: 'GRADUATED_MONITORING',
          sourceKey: 'monitor:' + record.id + ':' + cycle,
          dueAt: now,
          targetPath: safeTarget('en', 'GUARDIAN'),
        });
        r.monitoring++;
      }
    }
    // Existing pending suggestions only; evaluation never approves/creates an autonomous decision.
    const suggestions = await this.db
      .select({ id: s.graduationSuggestions.id, familyId: s.graduationSuggestions.familyId })
      .from(s.graduationSuggestions)
      .where(eq(s.graduationSuggestions.status, 'PENDING'))
      .limit(250);
    for (const suggestion of suggestions) {
      for (const pref of shared.filter(
        (p) => p.familyId === suggestion.familyId && p.actorKey.startsWith('GUARDIAN:'),
      )) {
        if (!canSend(now, pref.timezone, pref)) continue;
        await this.intent({
          familyId: suggestion.familyId,
          actorKey: pref.actorKey,
          kind: 'SUGGESTION_REVIEW',
          sourceKey: 'suggestion:' + suggestion.id,
          dueAt: now,
          targetPath: safeTarget('en', 'GUARDIAN'),
        });
        r.suggestions++;
      }
    }
    return r;
  }
  async claim(now = new Date(), limit = 10) {
    return this.db.transaction(async (tx) => {
      const stale = new Date(now.getTime() - 5 * 60_000);
      const selected = await tx
        .select()
        .from(s.outboxMessages)
        .where(
          and(
            lt(s.outboxMessages.attemptCount, 5),
            or(
              and(
                inArray(s.outboxMessages.status, ['PENDING', 'FAILED']),
                lte(s.outboxMessages.availableAt, now),
              ),
              and(eq(s.outboxMessages.status, 'PROCESSING'), lte(s.outboxMessages.lockedAt, stale)),
            ),
          ),
        )
        .orderBy(s.outboxMessages.createdAt)
        .limit(Math.min(20, limit))
        .for('update', { skipLocked: true });
      if (!selected.length) return [];
      const ids = selected.map((x) => x.id);
      await tx
        .update(s.outboxMessages)
        .set({
          status: 'PROCESSING',
          lockedAt: now,
          attemptCount: sql`${s.outboxMessages.attemptCount}+1`,
        })
        .where(inArray(s.outboxMessages.id, ids));
      return selected.map((x) => ({ ...x, attemptCount: x.attemptCount + 1 }));
    });
  }
  private async finish(id: string, attemptCount: number, errorCode: string | null) {
    const failed = errorCode !== null,
      terminal = attemptCount >= 5;
    await this.db
      .update(s.outboxMessages)
      .set({
        status: failed ? (terminal ? 'FAILED' : 'PENDING') : 'COMPLETED',
        availableAt: new Date(Date.now() + backoffMinutes(attemptCount) * 60_000),
        lockedAt: null,
        lastError: errorCode,
        processedAt: failed ? null : new Date(),
        attemptCount: failed && terminal ? 5 : attemptCount,
      })
      .where(and(eq(s.outboxMessages.id, id), eq(s.outboxMessages.status, 'PROCESSING')));
  }
  async work(now = new Date()) {
    const jobs = await this.claim(now, 10);
    let accepted = 0,
      failed = 0,
      suppressed = 0;
    for (const job of jobs) {
      const [intent] = await this.db
        .select()
        .from(s.notificationIntents)
        .where(eq(s.notificationIntents.id, job.intentId))
        .limit(1);
      if (!intent) {
        await this.finish(job.id, job.attemptCount, null);
        suppressed++;
        continue;
      }
      const [family] = await this.db
        .select({ timezone: s.families.timezone })
        .from(s.families)
        .where(eq(s.families.id, intent.familyId))
        .limit(1);
      const [pref] = await this.db
        .select()
        .from(s.notificationPreferences)
        .where(
          and(
            eq(s.notificationPreferences.familyId, intent.familyId),
            eq(s.notificationPreferences.actorKey, intent.actorKey),
          ),
        )
        .limit(1);
      // Quiet hours, opt-out, deleted subscriptions, expired intents suppress rather than postpone
      // stale reminders. Domain completion/reminder evidence is never mutated by push failures.
      if (
        !family ||
        !pref ||
        !canSend(now, family.timezone, pref) ||
        now.getTime() - intent.dueAt.getTime() > 75 * 60_000
      ) {
        await this.finish(job.id, job.attemptCount, null);
        suppressed++;
        continue;
      }
      const subs = await this.db
        .select()
        .from(s.pushSubscriptions)
        .where(
          and(
            eq(s.pushSubscriptions.familyId, intent.familyId),
            eq(s.pushSubscriptions.actorKey, intent.actorKey),
          ),
        );
      if (!subs.length) {
        await this.finish(job.id, job.attemptCount, null);
        suppressed++;
        continue;
      }
      let errorCode: string | null = null;
      for (const sub of subs) {
        try {
          await sendPush({
            subscription: { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.authSecret },
            kind: intent.kind as NotificationKind,
            targetPath: intent.targetPath,
          });
        } catch (error) {
          // Do not log push endpoint, subscription keys or child data.
          errorCode = 'PUSH_PROVIDER_FAILURE';
          const status = (error as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await this.db.delete(s.pushSubscriptions).where(eq(s.pushSubscriptions.id, sub.id));
            errorCode = null; // Revoked device is not retried.
          }
        }
      }
      await this.finish(job.id, job.attemptCount, errorCode);
      if (errorCode) failed++;
      else accepted++;
    }
    return { claimed: jobs.length, accepted, failed, suppressed };
  }
  async beginTick(now = new Date()): Promise<string | null> {
    const bucket = new Date(Math.floor(now.getTime() / 300_000) * 300_000);
    const id = newId<'SchedulerRunId'>();
    const [row] = await this.db
      .insert(s.schedulerRuns)
      .values({
        id,
        jobKey: 'SCHEDULER_TICK',
        bucket,
        status: 'RUNNING',
      })
      .onConflictDoNothing({ target: [s.schedulerRuns.jobKey, s.schedulerRuns.bucket] })
      .returning({ id: s.schedulerRuns.id });
    return row?.id ?? null;
  }
  async endTick(id: string, success: boolean) {
    await this.db
      .update(s.schedulerRuns)
      .set({
        status: success ? 'COMPLETED' : 'FAILED',
        finishedAt: new Date(),
        errorCode: success ? null : 'TICK_ERROR',
      })
      .where(eq(s.schedulerRuns.id, id));
  }
}
