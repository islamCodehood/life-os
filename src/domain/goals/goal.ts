export type GoalOwnerType = 'CHILD' | 'FAMILY';
export type GoalStatus = 'DRAFT' | 'AWAITING_APPROVAL' | 'ACTIVE' | 'PAUSED' | 'TARGET_DATE_REACHED' | 'ACHIEVED' | 'CLOSED';
export type StoredGoalStatus = Exclude<GoalStatus,'TARGET_DATE_REACHED'>;
export type GoalCategory = 'PERSONAL' | 'GROWTH' | 'PROJECT' | 'SHARED';
export interface Goal {
  id: string;
  familyId: string;
  ownerType: GoalOwnerType;
  ownerChildId: string | null;
  proposedByChildId: string | null;
  category: GoalCategory;
  title: string;
  why: string;
  nextStep: string;
  target: number;
  progress: number;
  targetDate: string | null;
  status: StoredGoalStatus;
  version: number;
  createdAt: Date;
}
export interface GoalProgressEntry {
  id: string; familyId: string; goalId: string; contributedByChildId: string | null;
  amount: number; step: string; occurredAt: Date; recordedAt: Date;
}
export interface GoalRevision {
  id: string; familyId: string; goalId: string; previousTarget: number; newTarget: number;
  previousTargetDate: string | null; newTargetDate: string | null;
  reason: string; revisedAt: Date;
}
export interface GoalReflection {
  id: string; familyId: string; goalId: string; authorChildId: string | null;
  text: string; createdAt: Date;
}
export class GoalRuleError extends Error {}
export function validateGoalCreation(input: {
  ownerType: GoalOwnerType; ownerChildId: string | null; category: GoalCategory;
  target: number; targetDate: string | null;
}) {
  if ((input.ownerType === 'FAMILY') !== (input.ownerChildId === null))
    throw new GoalRuleError('Family goals belong to the family; personal goals require one child.');
  if ((input.category === 'SHARED') !== (input.ownerType === 'FAMILY'))
    throw new GoalRuleError('Only family-owned goals may be shared.');
  if (!Number.isSafeInteger(input.target) || input.target < 1 || input.target > 1000000)
    throw new GoalRuleError('Goal target must be a positive whole number.');
  if (input.targetDate !== null && !isValidIsoDate(input.targetDate))
    throw new GoalRuleError('Target date is invalid.');
}
export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10) === value;
}
export function displayGoalStatus(goal: Goal, localToday: string): GoalStatus {
  return goal.status === 'ACTIVE' && goal.targetDate !== null && localToday > goal.targetDate
    ? 'TARGET_DATE_REACHED' : goal.status;
}
export function canAddProgress(goal: Goal, amount: number) {
  if (goal.status !== 'ACTIVE')
    throw new GoalRuleError('Only active goals accept progress.');
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 1000000)
    throw new GoalRuleError('Progress must be a positive whole number.');
  if (goal.progress + amount > goal.target)
    throw new GoalRuleError('Progress cannot exceed the goal target; revise the target first.');
}
export function canRevise(goal: Goal, target: number, date: string | null) {
  if (goal.status === 'ACHIEVED' || goal.status === 'CLOSED')
    throw new GoalRuleError('Finished goals cannot be revised.');
  validateGoalCreation({ownerType:goal.ownerType,ownerChildId:goal.ownerChildId,category:goal.category,target,targetDate:date});
  if (target < goal.progress)
    throw new GoalRuleError('Revised target cannot be less than recorded progress.');
}
export function canTransition(goal: Goal, to: StoredGoalStatus) {
  const allowed: Record<StoredGoalStatus, StoredGoalStatus[]> = {
    DRAFT:['AWAITING_APPROVAL','ACTIVE','CLOSED'],
    AWAITING_APPROVAL:['ACTIVE','CLOSED'],
    ACTIVE:['PAUSED','ACHIEVED','CLOSED'],
    PAUSED:['ACTIVE','CLOSED'],
    ACHIEVED:[], CLOSED:[],
  };
  if (!allowed[goal.status].includes(to))
    throw new GoalRuleError('Invalid goal state transition.');
  if (to === 'ACHIEVED' && goal.progress < goal.target)
    throw new GoalRuleError('Target must be reached before achievement.');
}
