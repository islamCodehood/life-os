'use client';

import { Button, Card } from '@life-os/design-system';
import { v7 as uuidv7 } from 'uuid';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
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
}

export interface ParentMakeBedPanelProps {
  childProfiles: ParentMakeBedChild[];
  messages: ActivityMessages;
}

export function ParentMakeBedPanel({ childProfiles, messages }: ParentMakeBedPanelProps) {
  const router = useRouter();
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function assign(childId: string) {
    if (assigningId) return;
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
            <Button type="button" disabled={assigningId !== null} onClick={() => assign(child.id)}>
              {assigningId === child.id ? messages.assigning : messages.assignMakeBed}
            </Button>
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
