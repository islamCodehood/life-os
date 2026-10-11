import type { MotionPreference } from '../identity/experience';
export const worldScopes = ['PERSONAL', 'FAMILY'] as const;
export type WorldScope = (typeof worldScopes)[number];
export const milestoneKeys = [
  'HOME_PATH',
  'BRIDGE_READY',
  'LIBRARY_OPEN',
  'OBSERVATORY_LIT',
  'GIVING_GARDEN',
  'FAMILY_TREE',
  'FAMILY_GARDEN',
] as const;
export type MilestoneKey = (typeof milestoneKeys)[number];
export type SemanticDimension =
  'INDEPENDENCE' | 'AUTONOMY' | 'LEARNING' | 'GOALS' | 'KINDNESS' | 'FAMILY';
export interface WorldFact {
  sourceEventId: string;
  familyId: string;
  childId: string | null;
  scope: WorldScope;
  milestoneKey: MilestoneKey;
  dimension: SemanticDimension;
  occurredAt: Date;
  recordedAt: Date;
}
export type WorldUnlock = WorldFact & { id: string; unlockedAt: Date };
export type SemanticImpactDto = {
  id: string;
  semanticKey: MilestoneKey;
  dimension: SemanticDimension;
  occurredAt: string;
};
export type WorldStateDto = {
  scope: WorldScope;
  stage: number;
  unlocks: Array<{ semanticKey: MilestoneKey; unlockedAt: string }>;
  recentImpacts: SemanticImpactDto[];
};
export function worldStage(unlocks: readonly { milestoneKey: MilestoneKey }[]): number {
  // Discrete visual growth, not a numerical score, streak, XP or child comparison.
  const count = new Set(unlocks.map((item) => item.milestoneKey)).size;
  return count >= 5 ? 3 : count >= 2 ? 2 : 1;
}
export function projectWorld(facts: readonly WorldFact[], now: Date): WorldStateDto {
  if (!facts.length) return { scope: 'PERSONAL', stage: 1, unlocks: [], recentImpacts: [] };
  const scope = facts[0]!.scope;
  const chosen = new Map<MilestoneKey, WorldFact>();
  const ordered = [...facts].sort(
    (a, b) =>
      a.occurredAt.getTime() - b.occurredAt.getTime() ||
      a.sourceEventId.localeCompare(b.sourceEventId),
  );
  for (const fact of ordered) {
    if (fact.scope !== scope) throw new Error('World scopes must remain separate.');
    if (!chosen.has(fact.milestoneKey)) chosen.set(fact.milestoneKey, fact);
  }
  const milestones = [...chosen.values()];
  const unlocks = milestones.map((f) => ({
    semanticKey: f.milestoneKey,
    unlockedAt: f.recordedAt.toISOString(),
  }));
  const recent = milestones
    .filter(
      (f) =>
        f.recordedAt.getTime() >= now.getTime() - 24 * 60 * 60 * 1000 &&
        f.recordedAt.getTime() <= now.getTime() + 5 * 60 * 1000,
    )
    .sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime());
  return {
    scope,
    stage: worldStage(milestones),
    unlocks,
    recentImpacts: recent.slice(0, 8).map((f) => ({
      id: f.sourceEventId,
      semanticKey: f.milestoneKey,
      dimension: f.dimension,
      occurredAt: f.occurredAt.toISOString(),
    })),
  };
}
export function emptyWorld(scope: WorldScope): WorldStateDto {
  return { scope, stage: 1, unlocks: [], recentImpacts: [] };
}
export function groupRecentImpacts(
  impacts: readonly SemanticImpactDto[],
  motion: MotionPreference,
) {
  if (motion === 'OFF') return [];
  // One grouped cue per semantic area. Bulk/offline replay NEVER emits one animation per event.
  const groups = new Map<MilestoneKey, { semanticKey: MilestoneKey; count: number }>();
  for (const impact of impacts) {
    const prior = groups.get(impact.semanticKey);
    groups.set(impact.semanticKey, {
      semanticKey: impact.semanticKey,
      count: (prior?.count ?? 0) + 1,
    });
  }
  return [...groups.values()].slice(0, motion === 'REDUCED' ? 1 : 3);
}
