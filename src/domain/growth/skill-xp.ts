import type { ActivityCategory, ActivityTemplateKey } from '@/src/domain/activity/entities';
import { resolveActivityPolicy } from '@/src/domain/activity/policy';

export type SkillKey = 'READING' | 'CHESS';
export type GrowthTemplateKey = 'GROWTH_READING' | 'GROWTH_CHESS_PRACTICE';
export const growthTemplates: readonly GrowthTemplateKey[] = [
  'GROWTH_READING', 'GROWTH_CHESS_PRACTICE',
];

// Pilot amounts/milestones are configurable policy candidates, not measures of moral worth.
const skillCatalog: Record<GrowthTemplateKey, { skill: SkillKey; xpPerOpportunity: number }> = {
  GROWTH_READING: { skill: 'READING', xpPerOpportunity: 10 },
  GROWTH_CHESS_PRACTICE: { skill: 'CHESS', xpPerOpportunity: 10 },
};
export const skillMilestones = [50, 100, 250] as const;

export function isGrowthTemplate(key: ActivityTemplateKey | null): key is GrowthTemplateKey {
  return key === 'GROWTH_READING' || key === 'GROWTH_CHESS_PRACTICE';
}

export function growthTemplateConfig(key: GrowthTemplateKey) {
  return skillCatalog[key];
}

// XP is inferred exclusively from the trusted definition + assignment + policy;
// never from a command payload, age, UI theme, recovery status or values.
export function awardForCompletion(input: {
  templateKey: ActivityTemplateKey | null;
  category: ActivityCategory;
  xpMode: string;
  xpAmount: number | null;
}): { skillKey: SkillKey; amount: number } | null {
  if (!isGrowthTemplate(input.templateKey)) return null;
  if (input.category !== 'GROWTH' || resolveActivityPolicy(input.category).xp !== 'ALLOWED')
    return null;
  const configured = skillCatalog[input.templateKey];
  if (input.xpMode !== 'ALLOWED' || input.xpAmount !== configured.xpPerOpportunity)
    return null;
  return { skillKey: configured.skill, amount: configured.xpPerOpportunity };
}

export interface XpEntry {
  id: string;
  familyId: string;
  childId: string;
  skillKey: SkillKey;
  entryType: 'GRANT' | 'CORRECTION';
  amount: number;
  sourceEventId: string;
  correctionOf: string | null;
  correctionReason: string | null;
  occurredAt: Date;
  recordedAt: Date;
}

export function skillProgressFromLedger(entries: readonly XpEntry[]) {
  const skills: SkillKey[] = ['READING', 'CHESS'];
  return skills.map((skillKey) => {
    const totalXp = entries.filter((entry) => entry.skillKey === skillKey)
      .reduce((sum, entry) => sum + entry.amount, 0);
    // Ledger corrections can never make historical mistakes into negative child scores.
    const xp = Math.max(0, totalXp);
    const achievedMilestones = skillMilestones.filter((milestone) => xp >= milestone);
    const nextMilestone = skillMilestones.find((milestone) => xp < milestone) ?? null;
    return { skillKey, xp, achievedMilestones, nextMilestone };
  });
}

export function validateCorrection(
  original: XpEntry, alreadyCorrected: boolean,
): number {
  if (original.entryType !== 'GRANT' || original.amount <= 0 || alreadyCorrected)
    throw new Error('XP grant cannot be corrected again.');
  return -original.amount;
}
