import type { ActivityCategory } from './entities';

export type ActivityProgressMode =
  'INDEPENDENCE' | 'FAMILY_CONTRIBUTION' | 'MASTERY' | 'VALUES_STORY' | 'FAITH_REFLECTION';

export interface ActivityPolicyDecision {
  progressMode: ActivityProgressMode;
  xp: 'FORBIDDEN' | 'TRAINING_ONLY' | 'ALLOWED';
  money: 'FORBIDDEN';
  approvalDefault: 'NONE' | 'GUARDIAN';
  graduationEligible: boolean;
}

const policies: Record<ActivityCategory, ActivityPolicyDecision> = {
  SELF_RESPONSIBILITY: {
    progressMode: 'INDEPENDENCE',
    xp: 'TRAINING_ONLY',
    money: 'FORBIDDEN',
    approvalDefault: 'NONE',
    graduationEligible: true,
  },
  FAMILY_RESPONSIBILITY: {
    progressMode: 'FAMILY_CONTRIBUTION',
    xp: 'TRAINING_ONLY',
    money: 'FORBIDDEN',
    approvalDefault: 'NONE',
    graduationEligible: true,
  },
  GROWTH: {
    progressMode: 'MASTERY',
    xp: 'ALLOWED',
    money: 'FORBIDDEN',
    approvalDefault: 'NONE',
    graduationEligible: false,
  },
  VALUES: {
    progressMode: 'VALUES_STORY',
    xp: 'FORBIDDEN',
    money: 'FORBIDDEN',
    approvalDefault: 'NONE',
    graduationEligible: false,
  },
  FAITH: {
    progressMode: 'FAITH_REFLECTION',
    xp: 'FORBIDDEN',
    money: 'FORBIDDEN',
    approvalDefault: 'NONE',
    graduationEligible: false,
  },
};

export function resolveActivityPolicy(category: ActivityCategory): ActivityPolicyDecision {
  return policies[category];
}
