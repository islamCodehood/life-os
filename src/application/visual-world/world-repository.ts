import type { WorldFact, WorldScope } from '@/src/domain/visual-world/world';
export interface WorldRepository {
  sourceFacts(familyId: string): Promise<WorldFact[]>;
  ensureUnlocks(facts: readonly WorldFact[]): Promise<void>;
  listPersisted(
    familyId: string,
    scope: WorldScope,
    childId: string | null,
  ): Promise<
    Array<{
      sourceEventId: string;
      milestoneKey: string;
    }>
  >;
}
