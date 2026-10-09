import type { AcceptedCommandResponse, OfflineCommandStatus } from '@/src/offline/model';

export type OfflineCommandEventPhase =
  'QUEUED' | 'SYNCING' | 'PENDING' | 'ACCEPTED' | 'CONFLICT' | 'FAILED';

export interface OfflineCommandEvent {
  actorKey: string;
  commandId: string;
  activityInstanceId: string;
  phase: OfflineCommandEventPhase;
  status?: OfflineCommandStatus;
  errorCode?: string;
  errorMessage?: string;
  response?: AcceptedCommandResponse;
}

const eventName = 'life-os:offline-command';

export function publishOfflineCommandEvent(detail: OfflineCommandEvent): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<OfflineCommandEvent>(eventName, { detail }));
}

export function subscribeOfflineCommandEvents(
  listener: (event: OfflineCommandEvent) => void,
): () => void {
  if (typeof window === 'undefined') return () => undefined;

  const handler = (event: Event) => {
    listener((event as CustomEvent<OfflineCommandEvent>).detail);
  };

  window.addEventListener(eventName, handler);
  return () => window.removeEventListener(eventName, handler);
}
