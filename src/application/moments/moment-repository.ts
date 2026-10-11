import type { Moment, MomentRevision } from '@/src/domain/moments/moment';
export interface MomentRepository {
  insert(moment: Moment): Promise<void>;
  lock(familyId: string, momentId: string): Promise<Moment | null>;
  listForChild(familyId: string, childId: string): Promise<Moment[]>;
  listForGuardian(familyId: string, childId?: string): Promise<Moment[]>;
  update(moment: Moment, expectedVersion: number): Promise<Moment | null>;
  appendRevision(revision: MomentRevision): Promise<void>;
  revisions(familyId: string, momentId: string): Promise<MomentRevision[]>;
}
