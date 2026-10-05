'use client';

import { TodayResponsibilityGroup } from '@life-os/design-system';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ActivityCardDto } from '@/src/application/activity/activity-service';
import type { ActivityMessages } from '@/src/i18n/activity-messages';
import { getBrowserOfflineRuntime } from '@/src/offline/browser-runtime';
import { executeCommand } from '@/src/offline/commands/execute-command';
import { subscribeOfflineCommandEvents } from '@/src/offline/events';
import type {
  OfflineActorScope,
  OfflineCommandRecord,
  OfflineCommandStatus,
} from '@/src/offline/model';

export interface ChildTodayResponsibilitiesProps {
  items: ActivityCardDto[];
  messages: ActivityMessages;
  referenceTime: string;
  actorScope: OfflineActorScope;
}

interface LocalCompletionState {
  commandId: string;
  status: OfflineCommandStatus;
}

function completionStateFromCommand(command: OfflineCommandRecord): LocalCompletionState {
  return {
    commandId: command.commandId,
    status: command.status,
  };
}

export function ChildTodayResponsibilities({
  items: initialItems,
  messages,
  referenceTime,
  actorScope,
}: ChildTodayResponsibilitiesProps) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [localCompletions, setLocalCompletions] = useState<Record<string, LocalCompletionState>>(
    {},
  );

  const { actorKey, familyId, childId, deviceId } = actorScope;

  useEffect(() => {
    const runtime = getBrowserOfflineRuntime();
    let active = true;
    let deactivateActor: (() => void) | undefined;

    const updateFromCommand = (command: OfflineCommandRecord) => {
      if (command.type !== 'CompleteActivity') return;
      const activityInstanceId = command.payload.activityInstanceId;

      setLocalCompletions((current) => ({
        ...current,
        [activityInstanceId]: completionStateFromCommand(command),
      }));
      setItems((current) =>
        current.map((item) =>
          item.id === activityInstanceId ? { ...item, status: 'completed' } : item,
        ),
      );
    };

    const unsubscribe = subscribeOfflineCommandEvents((event) => {
      if (event.actorKey !== actorKey) return;

      if (event.phase === 'ACCEPTED') {
        setLocalCompletions((current) => {
          if (current[event.activityInstanceId]?.commandId !== event.commandId) return current;
          const next = { ...current };
          delete next[event.activityInstanceId];
          return next;
        });

        const version = event.response?.resourceVersions?.find(
          (entry) =>
            entry.resourceType === 'ActivityInstance' &&
            entry.resourceId === event.activityInstanceId,
        )?.version;

        setItems((current) =>
          current.map((item) =>
            item.id === event.activityInstanceId
              ? {
                  ...item,
                  status: 'completed',
                  version: version ?? item.version,
                }
              : item,
          ),
        );
        router.refresh();
        return;
      }

      if (!event.status) return;
      setLocalCompletions((current) => ({
        ...current,
        [event.activityInstanceId]: {
          commandId: event.commandId,
          status: event.status,
        },
      }));
    });

    const scope: OfflineActorScope = { actorKey, familyId, childId, deviceId };

    const handleOnline = () => {
      setOnline(true);
      void runtime.signalSync(scope);
    };
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const hydrate = async () => {
      try {
        const commands = await runtime.store.listActorCommands(actorKey);
        if (!active) return;

        setOnline(navigator.onLine);
        for (const command of commands) updateFromCommand(command);

        deactivateActor = runtime.activateActor(scope);
      } catch {
        if (active) setError(messages.offlineStorageFailed);
      }
    };

    void hydrate();

    return () => {
      active = false;
      unsubscribe();
      deactivateActor?.();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [actorKey, childId, deviceId, familyId, messages.offlineStorageFailed, router]);

  async function complete(item: ActivityCardDto) {
    if (item.status !== 'pending' || savingId || localCompletions[item.id]) return;

    const now = new Date();
    if (now < new Date(item.availableFrom) || now > new Date(item.opportunityEndsAt)) return;

    setSavingId(item.id);
    setError(null);

    try {
      const command = await executeCommand({
        scope: actorScope,
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
      });

      setLocalCompletions((current) => ({
        ...current,
        [item.id]: completionStateFromCommand(command),
      }));
      setItems((current) =>
        current.map((entry) => (entry.id === item.id ? { ...entry, status: 'completed' } : entry)),
      );
    } catch {
      setError(messages.offlineStorageFailed);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <TodayResponsibilityGroup
      title={messages.todayTitle}
      eyebrow={messages.responsibilities}
      emptyState={messages.nothingToday}
      footer={error ? <p role="alert">{error}</p> : undefined}
      items={items.map((item) => {
        const referenceTimeMs = Date.parse(referenceTime);
        const available = referenceTimeMs >= Date.parse(item.availableFrom);
        const open = referenceTimeMs <= Date.parse(item.opportunityEndsAt);
        const local = localCompletions[item.id];
        const canComplete =
          item.status === 'pending' && !local && available && open && savingId === null;

        const localizedTitle =
          item.templateKey === 'SELF_MAKE_BED' ? messages.makeBedTitle : item.title;
        const localizedWhy = item.templateKey === 'SELF_MAKE_BED' ? messages.makeBedWhy : item.why;

        const localMeta =
          local?.status === 'CONFLICT'
            ? messages.offlineConflict
            : local?.status === 'FAILED'
              ? messages.offlineFailed
              : null;
        const scheduleMeta =
          item.status === 'pending' && !available
            ? messages.notAvailableYet
            : item.status === 'pending' && !open
              ? messages.opportunityClosed
              : null;
        const meta = localMeta ?? scheduleMeta;

        const syncState = local
          ? local.status === 'SYNCING' || (local.status === 'PENDING' && online)
            ? ('pending' as const)
            : ('offline' as const)
          : ('synced' as const);

        return {
          id: item.id,
          title: localizedTitle,
          whyLabel: messages.whyLabel,
          scheduleLabel: `${messages.targetPrefix}: ${item.scheduleLabel}`,
          status: item.status,
          syncState,
          ...(localizedWhy ? { why: localizedWhy } : {}),
          ...(meta ? { meta } : {}),
          ...(canComplete ? { onToggle: () => void complete(item) } : {}),
        };
      })}
    />
  );
}
