import { ActivityService } from '@/src/application/activity/activity-service';
import { GoalService } from '@/src/application/goals/goal-service';
import { PostgresGoalRepository } from '@/src/infrastructure/goals/postgres-goal-repository';
import { PostgresXpRepository } from '@/src/infrastructure/growth/postgres-xp-repository';
import { GraduationService } from '@/src/application/graduation/graduation-service';
import { PostgresGraduationRepository } from '@/src/infrastructure/graduation/postgres-graduation-repository';
import { PostgresActivityRepository } from '@/src/infrastructure/activity/postgres-activity-repository';
import { getDatabase } from '@/src/infrastructure/database/client';
import { createIdentityRuntime } from './identity-runtime';

export async function createActivityRuntime() {
  const identity = await createIdentityRuntime();
  const repository = new PostgresActivityRepository(getDatabase().db);
  const activities = new ActivityService(
    repository,
    identity.repository,
    identity.authorization,
    new PostgresXpRepository(getDatabase().db),
  );
  const graduations = new GraduationService(
    new PostgresGraduationRepository(getDatabase().db),
    repository,
    identity.repository,
  );

  const goals = new GoalService(
    new PostgresGoalRepository(getDatabase().db), identity.repository, repository,
  );

  return {
    ...identity,
    activityRepository: repository,
    activities,
    graduations,
    goals,
  };
}
