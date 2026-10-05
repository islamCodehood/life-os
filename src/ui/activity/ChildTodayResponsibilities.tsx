'use client';

import { TodayResponsibilityGroup } from '@life-os/design-system';
import { v7 as uuidv7 } from 'uuid';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ActivityCardDto } from '@/src/application/activity/activity-service';
import type { ActivityMessages } from '@/src/i18n/activity-messages';

export interface ChildTodayResponsibilitiesProps {
  items: ActivityCardDto[];
  messages: ActivityMessages;
}

export function ChildTodayResponsibilities({
  items: initialItems,
  messages,
}: ChildTodayResponsibilitiesProps) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function complete(item: ActivityCardDto) {
    if (item.status !== 'pending' || pendingId) return;

    const now = new Date();
    if (now < new Date(item.availableFrom) || now > new Date(item.opportunityEndsAt)) return;

    setPendingId(item.id);
    setError(null);

    try {
      const response = await fetch('/api/v1/commands', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          commandId: uuidv7(),
          schemaVersion: 1,
          type: 'CompleteActivity',
          occurredAt: now.toISOString(),
          expectedVersions: [
            {
              resourceType: 'ActivityInstance',
              resourceId: item.id,
              version: item.version,
            },
          ],
          payload: { activityInstanceId: item.id },
        }),
      });

      if (!response.ok) throw new Error('CompleteActivity failed.');

      const body = (await response.json()) as {
        resourceVersions?: Array<{ resourceType: string; resourceId: string; version: number }>;
      };
      const version = body.resourceVersions?.find(
        (entry) => entry.resourceType === 'ActivityInstance' && entry.resourceId === item.id,
      )?.version;

      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id
            ? { ...entry, status: 'completed', version: version ?? entry.version + 1 }
            : entry,
        ),
      );
      router.refresh();
    } catch {
      setError(messages.completionFailed);
    } finally {
      setPendingId(null);
    }
  }

  const now = Date.now();

  return (
    <TodayResponsibilityGroup
      title={messages.todayTitle}
      eyebrow={messages.responsibilities}
      emptyState={messages.nothingToday}
      footer={error ? <p role="alert">{error}</p> : undefined}
      items={items.map((item) => {
        const available = now >= Date.parse(item.availableFrom);
        const open = now <= Date.parse(item.opportunityEndsAt);
        const canComplete = item.status === 'pending' && available && open && pendingId === null;
        const localizedTitle =
          item.templateKey === 'SELF_MAKE_BED' ? messages.makeBedTitle : item.title;
        const localizedWhy =
          item.templateKey === 'SELF_MAKE_BED' ? messages.makeBedWhy : item.why;

        return {
          id: item.id,
          title: localizedTitle,
          why: localizedWhy ?? undefined,
          whyLabel: messages.whyLabel,
          scheduleLabel: `${messages.targetPrefix}: ${item.scheduleLabel}`,
          status: item.status,
          syncState: pendingId === item.id ? ('pending' as const) : ('synced' as const),
          meta:
            item.status === 'pending' && !available
              ? messages.notAvailableYet
              : item.status === 'pending' && !open
                ? messages.opportunityClosed
                : undefined,
          onToggle: canComplete ? () => complete(item) : undefined,
        };
      })}
    />
  );
}
