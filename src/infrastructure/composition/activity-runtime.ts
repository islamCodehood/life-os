import { ActivityService } from '@/src/application/activity/activity-service';
import { GraduationService } from '@/src/application/graduation/graduation-service';
import { PostgresGraduationRepository } from '@/src/infrastructure/graduation/postgres-graduation-repository';
import { PostgresActivityRepository } from '@/src/infrastructure/activity/postgres-activity-repository';
import { getDatabase } from '@/src/infrastructure/database/client';
import { createIdentityRuntime } from './identity-runtime';

export async function createActivityRuntime() {
  const identity = await createIdentityRuntime();
  const repository = new PostgresActivityRepository(getDatabase().db);
  const activities = new ActivityService(repository, identity.repository, identity.authorization);
  const graduations = new GraduationService(
    new PostgresGraduationRepository(getDatabase().db),
    repository,
    identity.repository,
  );

  return {
    ...identity,
    activityRepository: repository,
    activities,
    graduations,
  };
}
