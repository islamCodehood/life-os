import type { OfflineActorScope } from './model';

export function childOfflineActorScope(input: {
  familyId: string;
  childId: string;
  deviceId: string;
}): OfflineActorScope {
  return {
    actorKey: ['child', input.familyId, input.childId, input.deviceId].join(':'),
    familyId: input.familyId,
    childId: input.childId,
    deviceId: input.deviceId,
  };
}
