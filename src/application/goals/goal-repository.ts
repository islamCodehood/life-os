import type {
  Goal,
  GoalProgressEntry,
  GoalRevision,
  GoalReflection,
  StoredGoalStatus,
} from '@/src/domain/goals/goal';

export interface GoalRepository {
  insertGoal(goal: Goal): Promise<void>;
  getGoal(familyId: string, goalId: string): Promise<Goal | null>;
  lockGoal(familyId: string, goalId: string): Promise<Goal | null>;
  listChildVisible(familyId: string, childId: string): Promise<Goal[]>;
  listFamilyGoals(familyId: string): Promise<Goal[]>;
  insertProgress(entry: GoalProgressEntry): Promise<void>;
  insertRevision(revision: GoalRevision): Promise<void>;
  insertReflection(reflection: GoalReflection): Promise<void>;
  updateGoal(input: {
    familyId: string;
    id: string;
    expectedVersion: number;
    patch: Partial<Pick<Goal, 'target' | 'targetDate' | 'progress' | 'nextStep' | 'status'>>;
    updatedAt: Date;
  }): Promise<Goal | null>;
  listProgress(familyId: string, goalId: string): Promise<GoalProgressEntry[]>;
  listRevisions(familyId: string, goalId: string): Promise<GoalRevision[]>;
  listReflections(familyId: string, goalId: string): Promise<GoalReflection[]>;
}
