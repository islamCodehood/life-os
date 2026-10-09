'use client';

import { Button, Card } from '@life-os/design-system';
import { v7 as uuidv7 } from 'uuid';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ActivityProgressMetrics } from '@/src/domain/activity/progress';
import type { ActivityMessages } from '@/src/i18n/activity-messages';

export interface ParentMakeBedChild {
  id: string;
  displayName: string;
  assigned: boolean;
  activeFrom?: string;
  history: Array<{
    id: string;
    label: string;
    selfInitiated: boolean;
  }>;
  insight: {
    metrics: ActivityProgressMetrics;
    unresolved: Array<{
      id: string;
      version: number;
      label: string;
    }>;
  } | null;
}

export interface ParentMakeBedPanelProps {
  childProfiles: ParentMakeBedChild[];
  messages: ActivityMessages;
  locale: 'en' | 'ar';
}

function formatRate(value: number | null, locale: 'en' | 'ar') {
  if (value === null) return '—';
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number | null, locale: 'en' | 'ar') {
  if (value === null) return '—';
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
  }).format(value);
}

export function ParentMakeBedPanel({
  childProfiles,
  messages,
  locale,
}: ParentMakeBedPanelProps) {
  const router = useRouter();
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function assign(childId: string) {
    if (assigningId || resolvingId) return;
    setAssigningId(childId);
    setError(null);

    try {
      const response = await fetch('/api/v1/commands', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          commandId: uuidv7(),
          schemaVersion: 1,
          type: 'AssignMakeBed',
          occurredAt: new Date().toISOString(),
          payload: { childId },
        }),
      });

      if (!response.ok) throw new Error('AssignMakeBed failed.');
      router.refresh();
    } catch {
      setError(messages.completionFailed);
    } finally {
      setAssigningId(null);
    }
  }

  async function resolveOpportunity(input: {
    id: string;
    version: number;
    type: 'MarkActivityMissed' | 'ExcuseActivity';
  }) {
    if (assigningId || resolvingId) return;
    setResolvingId(input.id);
    setError(null);

    try {
      const response = await fetch('/api/v1/commands', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          commandId: uuidv7(),
          schemaVersion: 1,
          type: input.type,
          occurredAt: new Date().toISOString(),
          expectedVersions: [
            {
              resourceType: 'ActivityInstance',
              resourceId: input.id,
              version: input.version,
            },
          ],
          payload: { activityInstanceId: input.id },
        }),
      });

      if (!response.ok) throw new Error('Resolve activity failed.');
      router.refresh();
    } catch {
      setError(messages.resolutionFailed);
    } finally {
      setResolvingId(null);
    }
  }

  return (
    <section aria-labelledby="make-bed-pilot-title">
      <h2 id="make-bed-pilot-title">{messages.makeBedSetupTitle}</h2>
      <p>{messages.makeBedSetupIntro}</p>

      {error && <p role="alert">{error}</p>}

      {childProfiles.map((child) => (
        <Card key={child.id} className="lo-app-foundation__card" variant="soft">
          <strong>{child.displayName}</strong>
          <p>{child.assigned ? messages.assigned : messages.makeBedTitle}</p>

          {!child.assigned && (
            <Button
              type="button"
              disabled={assigningId !== null || resolvingId !== null}
              onClick={() => assign(child.id)}
            >
              {assigningId === child.id ? messages.assigning : messages.assignMakeBed}
            </Button>
          )}

          {child.insight && (
            <section aria-label={messages.insightsTitle}>
              <h3>{messages.insightsTitle}</h3>
              <dl>
                <div>
                  <dt>{messages.consistency}</dt>
                  <dd>{formatRate(child.insight.metrics.consistencyRate, locale)}</dd>
                </div>
                <div>
                  <dt>{messages.completionRate}</dt>
                  <dd>{formatRate(child.insight.metrics.completionRate, locale)}</dd>
                </div>
                <div>
                  <dt>{messages.selfInitiationRate}</dt>
                  <dd>{formatRate(child.insight.metrics.selfInitiationRate, locale)}</dd>
                </div>
                <div>
                  <dt>{messages.reminderDependency}</dt>
                  <dd>{formatRate(child.insight.metrics.reminderDependencyRate, locale)}</dd>
                </div>
                <div>
                  <dt>{messages.averageReminders}</dt>
                  <dd>
                    {formatNumber(
                      child.insight.metrics.averageRemindersPerOpportunity,
                      locale,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>{messages.onTimeRate}</dt>
                  <dd>{formatRate(child.insight.metrics.onTimeRate, locale)}</dd>
                </div>
                <div>
                  <dt>{messages.dataCoverage}</dt>
                  <dd>{formatRate(child.insight.metrics.dataCoverage, locale)}</dd>
                </div>
              </dl>

              <p>
                {child.insight.metrics.coverageAllowsReadinessEvaluation
                  ? messages.evidenceComplete
                  : messages.keepObserving}
              </p>

              <h4>{messages.recoveryTitle}</h4>
              <p>
                {child.insight.metrics.recoveryOpen
                  ? messages.recoveryOpen
                  : child.insight.metrics.latestRecoveryLatency === null
                    ? messages.noRecoveryYet
                    : `${messages.recoveryLatency}: ${formatNumber(
                        child.insight.metrics.latestRecoveryLatency,
                        locale,
                      )} ${messages.opportunities}`}
              </p>

              {child.insight.unresolved.length > 0 && (
                <section aria-label={messages.unresolvedTitle}>
                  <h4>{messages.unresolvedTitle}</h4>
                  <p>{messages.unresolvedIntro}</p>
                  <ul>
                    {child.insight.unresolved.map((entry) => (
                      <li key={entry.id}>
                        <span>{entry.label}</span>{' '}
                        <Button
                          type="button"
                          disabled={resolvingId !== null || assigningId !== null}
                          onClick={() =>
                            void resolveOpportunity({
                              id: entry.id,
                              version: entry.version,
                              type: 'MarkActivityMissed',
                            })
                          }
                        >
                          {resolvingId === entry.id
                            ? messages.resolving
                            : messages.markMissed}
                        </Button>{' '}
                        <Button
                          type="button"
                          disabled={resolvingId !== null || assigningId !== null}
                          onClick={() =>
                            void resolveOpportunity({
                              id: entry.id,
                              version: entry.version,
                              type: 'ExcuseActivity',
                            })
                          }
                        >
                          {resolvingId === entry.id ? messages.resolving : messages.excuse}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </section>
          )}

          <h3>{messages.historyTitle}</h3>
          {child.history.length === 0 ? (
            <p>{messages.noHistory}</p>
          ) : (
            <ul>
              {child.history.map((entry) => (
                <li key={entry.id}>
                  {messages.completed}: {entry.label}
                  {' · '}
                  {entry.selfInitiated ? messages.selfInitiated : messages.guardianRecorded}
                </li>
              ))}
            </ul>
          )}
        </Card>
      ))}
    </section>
  );
}
