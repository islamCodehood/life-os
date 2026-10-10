import { ActivityService } from '@/src/application/activity/activity-service';
import { MomentService } from '@/src/application/moments/moment-service';
import { PostgresMomentRepository } from '@/src/infrastructure/moments/postgres-moment-repository';
import { MoneyService } from '@/src/application/money/money-service';
import { JobService } from '@/src/application/jobs/job-service';
import { PostgresMoneyRepository } from '@/src/infrastructure/money/postgres-money-repository';
import { PostgresJobRepository } from '@/src/infrastructure/jobs/postgres-job-repository';
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
    new PostgresGoalRepository(getDatabase().db),
    identity.repository,
    repository,
  );

  const money = new MoneyService(
    new PostgresMoneyRepository(getDatabase().db),
    identity.repository,
  );
  const jobs = new JobService(
    new PostgresJobRepository(getDatabase().db),
    identity.repository,
    money,
  );
  const moments = new MomentService(
    new PostgresMomentRepository(getDatabase().db),identity.repository,repository,
  );

  return {
    ...identity,
    activityRepository: repository,
    activities,
    graduations,
    goals,
    moments,
    money,
    jobs,
  };
}
