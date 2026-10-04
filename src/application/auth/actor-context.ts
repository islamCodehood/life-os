import type { ChildId, DeviceId, FamilyId, GuardianId } from '@/src/domain/shared/id';

export type ActorContext =
  | {
      kind: 'GUARDIAN';
      familyId: FamilyId;
      guardianId: GuardianId;
      deviceId?: DeviceId;
    }
  | {
      kind: 'CHILD';
      familyId: FamilyId;
      childId: ChildId;
      deviceId: DeviceId;
    }
  | {
      kind: 'SYSTEM';
      familyId?: FamilyId;
    };
