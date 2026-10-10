'use client';

import { Button, Card } from '@life-os/design-system';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { v7 as uuidv7 } from 'uuid';
import type { ActivityMessages } from '@/src/i18n/activity-messages';

export interface GrowthChild {
  id: string;
  displayName: string;
  readingAssigned: boolean;
  chessAssigned: boolean;
  skills: Array<{
    skillKey: 'READING' | 'CHESS';
    xp: number;
    achievedMilestones: readonly number[];
    nextMilestone: number | null;
  }>;
  xpHistory: Array<{
    id: string;
    skillKey: 'READING' | 'CHESS';
    entryType: 'GRANT' | 'CORRECTION';
    amount: number;
    correctionOf: string | null;
    occurredAt: string;
  }>;
}

export function ParentGrowthPanel({
  childProfiles,
  messages,
}: {
  childProfiles: GrowthChild[];
  messages: ActivityMessages;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});

  async function send(childId: string, type: string, payload: Record<string, unknown>) {
    if (busy) return;
    setBusy(childId);
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
          payload,
        }),
      });
      if (!response.ok) throw new Error('Failed to save growth command.');
      router.refresh();
    } catch {
      setError(messages.growthFailed);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-labelledby="growth-parent-title">
      <h2 id="growth-parent-title">{messages.growthTitle}</h2>
      <p>{messages.growthIntro}</p>
      {error && <p role="alert">{error}</p>}
      {childProfiles.map((child) => {
        const corrected = new Set(
          child.xpHistory.filter((e) => e.entryType === 'CORRECTION').map((e) => e.correctionOf),
        );
        return (
          <Card key={child.id} className="lo-app-foundation__card" variant="soft">
            <h3>{child.displayName}</h3>
            <p>{messages.growthPracticeIntro}</p>
            {!child.readingAssigned && (
              <Button
                type="button"
                disabled={!!busy}
                onClick={() =>
                  void send(child.id, 'AssignGrowthPractice', {
                    childId: child.id,
                    templateKey: 'GROWTH_READING',
                  })
                }
              >
                {messages.assignReading}
              </Button>
            )}
            {!child.chessAssigned && (
              <Button
                type="button"
                disabled={!!busy}
                onClick={() =>
                  void send(child.id, 'AssignGrowthPractice', {
                    childId: child.id,
                    templateKey: 'GROWTH_CHESS_PRACTICE',
                  })
                }
              >
                {messages.assignChess}
              </Button>
            )}
            <ul>
              {child.skills.map((skill) => (
                <li key={skill.skillKey}>
                  <strong>
                    {skill.skillKey === 'READING' ? messages.readingSkill : messages.chessSkill}:
                  </strong>{' '}
                  {skill.xp} XP
                  {skill.nextMilestone !== null && (
                    <span>
                      {' '}
                      · {messages.nextMilestone}: {skill.nextMilestone} XP
                    </span>
                  )}
                  {skill.achievedMilestones.length > 0 && (
                    <span>
                      {' '}
                      · {messages.milestonesReached}: {skill.achievedMilestones.join(', ')}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {child.xpHistory.filter((e) => e.entryType === 'GRANT' && !corrected.has(e.id)).length >
              0 && (
              <section aria-label={messages.xpCorrectionTitle}>
                <h4>{messages.xpCorrectionTitle}</h4>
                <p>{messages.xpCorrectionExplanation}</p>
                <ul>
                  {child.xpHistory
                    .filter((e) => e.entryType === 'GRANT' && !corrected.has(e.id))
                    .slice(-5)
                    .map((entry) => (
                      <li key={entry.id}>
                        {entry.skillKey === 'READING' ? messages.readingSkill : messages.chessSkill}{' '}
                        +{entry.amount} XP{' '}
                        <label>
                          {messages.correctionReason}{' '}
                          <input
                            type="text"
                            value={reasons[entry.id] ?? ''}
                            maxLength={400}
                            onChange={(event) =>
                              setReasons((current) => ({
                                ...current,
                                [entry.id]: event.target.value,
                              }))
                            }
                          />
                        </label>{' '}
                        <Button
                          type="button"
                          disabled={!!busy || (reasons[entry.id]?.trim().length ?? 0) < 5}
                          onClick={() =>
                            void send(child.id, 'CorrectXpGrant', {
                              xpEntryId: entry.id,
                              reason: reasons[entry.id]?.trim(),
                            })
                          }
                        >
                          {messages.correctXp}
                        </Button>
                      </li>
                    ))}
                </ul>
              </section>
            )}
          </Card>
        );
      })}
    </section>
  );
}
