import { ActivityService } from '@/src/application/activity/activity-service';
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
  );

  return {
    ...identity,
    activityRepository: repository,
    activities,
  };
}
