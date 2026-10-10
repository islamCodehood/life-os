'use client';

import { Button, Card } from '@life-os/design-system';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { v7 as uuidv7 } from 'uuid';
import type { ActivityMessages } from '@/src/i18n/activity-messages';
import type { GraduationService } from '@/src/application/graduation/graduation-service';

type Overview = NonNullable<Awaited<ReturnType<GraduationService['parentOverview']>>>;

export interface ParentGraduationChild {
  id: string;
  displayName: string;
  graduation: Overview | null;
  evidence: {
    coverageComplete: boolean;
    applicableOpportunities: number;
    recoveryOpen: boolean;
  } | null;
}

export function ParentGraduationPanel({
  childProfiles,
  messages,
}: {
  childProfiles: ParentGraduationChild[];
  messages: ActivityMessages;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function command(
    childId: string,
    type: string,
    payload: Record<string, unknown>,
    version?: number,
  ) {
    if (busyId) return;
    setBusyId(childId);
    setError(null);
    try {
      const response = await fetch('/api/v1/commands', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          commandId: uuidv7(),
          schemaVersion: 1,
          type,
          occurredAt: new Date().toISOString(),
          ...(version === undefined
            ? {}
            : {
                expectedVersions: [
                  {
                    resourceType: 'ActivityAssignment',
                    resourceId: childProfiles.find((child) => child.id === childId)?.graduation
                      ?.assignmentId,
                    version,
                  },
                ],
              }),
          payload,
        }),
      });
      if (!response.ok) throw new Error('Graduation command was not accepted.');
      router.refresh();
    } catch {
      setError(messages.graduationFailed);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section aria-labelledby="graduation-title">
      <h2 id="graduation-title">{messages.graduationTitle}</h2>
      <p>{messages.graduationIntro}</p>
      {error && <p role="alert">{error}</p>}
      {childProfiles.map((child) => {
        const item = child.graduation;
        if (!item) return null;
        const busy = busyId !== null;
        const eligibleForReview =
          child.evidence?.coverageComplete === true &&
          (child.evidence?.applicableOpportunities ?? 0) > 0 &&
          child.evidence?.recoveryOpen === false;
        return (
          <Card className="lo-app-foundation__card" variant="soft" key={child.id}>
            <h3>{child.displayName}</h3>
            {item.status === 'ACTIVE' ? (
              <>
                <p>{messages.activeTracking}</p>
                {!item.suggestionId ? (
                  <>
                    <p>{messages.reviewCaution}</p>
                    <Button
                      type="button"
                      disabled={busy || !eligibleForReview}
                      onClick={() =>
                        void command(child.id, 'RequestGraduationReview', {
                          assignmentId: item.assignmentId,
                        })
                      }
                    >
                      {messages.requestGraduationReview}
                    </Button>
                  </>
                ) : (
                  <>
                    <p>{messages.guardianReviewPending}</p>
                    <Button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void command(
                          child.id,
                          'ApproveGraduation',
                          { suggestionId: item.suggestionId, monitoringIntervalDays: 14 },
                          item.assignmentVersion,
                        )
                      }
                    >
                      {messages.approveGraduation}
                    </Button>{' '}
                    <Button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void command(child.id, 'DeclineGraduation', {
                          suggestionId: item.suggestionId,
                        })
                      }
                    >
                      {messages.decline}
                    </Button>{' '}
                    <Button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void command(child.id, 'SnoozeGraduation', {
                          suggestionId: item.suggestionId,
                        })
                      }
                    >
                      {messages.snooze}
                    </Button>
                  </>
                )}
              </>
            ) : (
              <>
                <p>
                  {messages.graduatedMonitoring} · {item.monitoringIntervalDays}{' '}
                  {messages.monitoringDays}
                </p>
                <p>
                  {messages.monitoringStatus}:{' '}
                  {item.monitoringState === 'STABLE'
                    ? messages.monitoringStable
                    : item.monitoringState === 'OVERDUE'
                      ? messages.monitoringOverdue
                      : item.monitoringState === 'WATCH'
                        ? messages.monitoringWatch
                        : messages.monitoringReview}
                </p>
                <p>
                  {messages.observationCount}: {item.observationCount}
                </p>
                {item.graduationRecordId && (
                  <div>
                    <p>{messages.recordObservation}</p>
                    <Button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void command(child.id, 'RecordGraduatedObservation', {
                          graduationRecordId: item.graduationRecordId,
                          result: 'STABLE',
                        })
                      }
                    >
                      {messages.observationStable}
                    </Button>{' '}
                    <Button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void command(child.id, 'RecordGraduatedObservation', {
                          graduationRecordId: item.graduationRecordId,
                          result: 'SOMETIMES_NEEDS_HELP',
                        })
                      }
                    >
                      {messages.observationSomeHelp}
                    </Button>{' '}
                    <Button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void command(child.id, 'RecordGraduatedObservation', {
                          graduationRecordId: item.graduationRecordId,
                          result: 'NEEDS_REGULAR_SUPPORT',
                        })
                      }
                    >
                      {messages.observationRegularSupport}
                    </Button>
                  </div>
                )}
                {item.suggestionId && item.suggestionKind === 'REACTIVATION' && (
                  <div>
                    <p>{messages.reactivationReview}</p>
                    <Button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void command(
                          child.id,
                          'ApproveReactivation',
                          { suggestionId: item.suggestionId },
                          item.assignmentVersion,
                        )
                      }
                    >
                      {messages.approveReactivation}
                    </Button>{' '}
                    <Button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void command(child.id, 'DeclineReactivation', {
                          suggestionId: item.suggestionId,
                        })
                      }
                    >
                      {messages.decline}
                    </Button>
                  </div>
                )}
              </>
            )}
          </Card>
        );
      })}
    </section>
  );
}
