import type { FamilyId, ChildId } from '@/src/domain/shared/id';
import type { XpEntry } from '@/src/domain/growth/skill-xp';

export interface XpRepository {
  append(entry: XpEntry): Promise<void>;
  getEntry(familyId: FamilyId, id: string): Promise<XpEntry | null>;
  hasCorrection(familyId: FamilyId, grantId: string): Promise<boolean>;
  listChildEntries(familyId: FamilyId, childId: ChildId): Promise<XpEntry[]>;
}
